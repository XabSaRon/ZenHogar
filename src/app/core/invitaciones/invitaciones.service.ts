import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc, collection, serverTimestamp,
  query, where, getDocs,
  doc, runTransaction, arrayUnion,
  FirestoreError,
} from '@angular/fire/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Invitacion } from './invitacion.model';
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
    const q = query(
      collection(this.fs, 'invitaciones'),
      where('codigo', '==', codigo),
      where('usado', '==', false)
    );
    const snap = await getDocs(q);
    return snap.empty
      ? null
      : { id: snap.docs[0].id, ...(snap.docs[0].data() as Invitacion) };
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

    await runTransaction(this.fs, async (trx) => {
      const hogarSnap = await trx.get(hogarRef);
      if (!hogarSnap.exists()) throw new Error('Hogar no encontrado');

      trx.update(hogarRef, { miembros: arrayUnion(user.uid) });

      trx.update(invRef, {
        usado: true,
        usadoPorUid: user.uid,
        usadoEn: serverTimestamp(),
      });
    }).catch((err: FirestoreError) => {
      throw new Error('No se pudo completar la invitación: ' + err.message);
    });
  }
}

