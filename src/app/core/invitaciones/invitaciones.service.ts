import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from '@angular/fire/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Invitacion } from './invitacion.model';

@Injectable({ providedIn: 'root' })
export class InvitacionesService {
  private fs = inject(Firestore);

  async crearInvitacion(hogarId: string, email: string): Promise<string> {
    const codigo = uuidv4().slice(0, 8);

    await addDoc(collection(this.fs, 'invitaciones'), {
      hogarId,
      email,
      codigo,
      creadoEn: serverTimestamp(),
      usado: false,
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

  async marcarUsado(invId: string) {
    await updateDoc(doc(this.fs, 'invitaciones', invId), { usado: true });
  }
}
