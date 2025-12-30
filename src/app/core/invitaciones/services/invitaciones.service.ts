import { Injectable, inject } from '@angular/core';
import { Firestore, addDoc, collection, serverTimestamp, query, where, getDocs, doc, runTransaction, arrayUnion } from '@angular/fire/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Invitacion } from '../models/invitacion.model';
import { Auth } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class InvitacionesService {
  private fs = inject(Firestore);
  private auth = inject(Auth);

  async crearInvitacion(hogarId: string, email: string): Promise<string> {
    const codigo = uuidv4().slice(0, 8);

    await addDoc(collection(this.fs, 'invitaciones'), {
      hogarId,
      email,
      codigo,
      creadoEn: serverTimestamp(),
      usado: false,
      usadoPorUid: null,
      usadoEn: null,
    });

    return codigo;
  }

  async validarCodigo(codigo: string): Promise<Invitacion | null> {
    const user = this.auth.currentUser;
    if (!user?.email) throw new Error('Tu cuenta no tiene email');

    const q = query(
      collection(this.fs, 'invitaciones'),
      where('codigo', '==', codigo),
      where('usado', '==', false),
      where('email', '==', user.email)
    );

    const snap = await getDocs(q);
    return snap.empty ? null : { id: snap.docs[0].id, ...(snap.docs[0].data() as Invitacion) };
  }

  async aceptarCodigo(codigo: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Debes iniciar sesión');
    if (!user.email) throw new Error('Tu cuenta no tiene email');

    const invit = await this.validarCodigo(codigo);
    if (!invit) throw new Error('Código inválido o ya usado');

    if (invit.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new Error('Este código no corresponde con tu email');
    }

    const invRef = doc(this.fs, 'invitaciones', invit.id!);
    const hogarRef = doc(this.fs, 'hogares', invit.hogarId);
    const userRef = doc(this.fs, 'usuarios', user.uid);

    await runTransaction(this.fs, async (trx) => {
      // 1) Leer usuario y bloquear si ya está en un hogar
      const userSnap = await trx.get(userRef);
      const userData = userSnap.exists() ? (userSnap.data() as any) : null;

      const hogarIdActual = userData?.hogarId ?? null;
      if (hogarIdActual) {
        throw new Error('Ya perteneces a un hogar');
      }

      // 2) Leer hogar
      const hogarSnap = await trx.get(hogarRef);
      if (!hogarSnap.exists()) throw new Error('Hogar no encontrado');

      const hogarData = hogarSnap.data() as any;
      const miembros: string[] = Array.isArray(hogarData?.miembros) ? hogarData.miembros : [];

      if (!miembros.includes(user.uid)) {
        trx.update(hogarRef, { miembros: arrayUnion(user.uid) });
      }

      // 3) Marcar invitación como usada
      trx.update(invRef, {
        usado: true,
        usadoPorUid: user.uid,
        usadoEn: serverTimestamp(),
      });

      // 4) Guardar hogarId en el usuario
      trx.set(
        userRef,
        { hogarId: invit.hogarId, actualizadoEn: serverTimestamp() },
        { merge: true }
      );
    }).catch((err: any) => {
      throw new Error(err?.message ? err.message : ('No se pudo completar la invitación'));
    });
  }
}

