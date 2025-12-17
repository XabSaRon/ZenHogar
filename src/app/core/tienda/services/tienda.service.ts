import { Injectable } from '@angular/core';
import {
  Firestore,
  doc,
  collection,
  setDoc,
  collectionData,
  runTransaction,
  deleteDoc,
  updateDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Recompensa } from '../models/tienda.model';

@Injectable({ providedIn: 'root' })
export class TiendaService {

  constructor(private fs: Firestore) { }

  async canjearRecompensa(
    usuarioId: string,
    puntosGastados: number,
    recompensa: Recompensa
  ): Promise<void> {
    const usuarioRef = doc(this.fs, `usuarios/${usuarioId}`);
    const canjeosRef = collection(this.fs, `usuarios/${usuarioId}/canjeos`);

    return runTransaction(this.fs, async (tx) => {
      const snap = await tx.get(usuarioRef);
      if (!snap.exists()) {
        throw new Error('Usuario no encontrado');
      }

      const datos = snap.data() as any;
      const puntosActuales = datos.puntos ?? 0;

      if (puntosActuales < puntosGastados) {
        throw new Error('No tienes suficientes puntos');
      }

      // Actualizamos puntos
      tx.update(usuarioRef, {
        puntos: puntosActuales - puntosGastados
      });

      // Guardamos histórico de canjeo
      const canjeoRef = doc(canjeosRef);
      tx.set(canjeoRef, {
        recompensaId: recompensa.id,
        titulo: recompensa.titulo,
        puntosGastados,
        tipo: recompensa.tipo,
        fecha: new Date()
      });
    });
  }

  getRecompensasPersonalizadas(hogarId: string): Observable<Recompensa[]> {
    const ref = collection(this.fs, `hogares/${hogarId}/recompensasPersonalizadas`);
    return collectionData(ref, { idField: 'id' }) as Observable<Recompensa[]>;
  }

  crearRecompensaPersonalizada(hogarId: string, data: any): Promise<any> {
    const colRef = collection(this.fs, `hogares/${hogarId}/recompensasPersonalizadas`);
    const docRef = doc(colRef);
    const toSave = { ...data, id: docRef.id };

    return setDoc(docRef, toSave).then(() => toSave);
  }

  async borrarRecompensaPersonalizada(hogarId: string, recompensaId: string): Promise<void> {
    const ref = doc(this.fs, `hogares/${hogarId}/recompensasPersonalizadas/${recompensaId}`);
    await deleteDoc(ref);
  }


  async actualizarRecompensaPersonalizada(
    hogarId: string,
    recompensaId: string,
    changes: any
  ): Promise<void> {
    const ref = doc(this.fs, `hogares/${hogarId}/recompensasPersonalizadas/${recompensaId}`);
    await updateDoc(ref, changes);
  }

}
