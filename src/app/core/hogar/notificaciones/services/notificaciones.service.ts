import { Injectable } from '@angular/core';
import { Firestore, collection, doc, addDoc, query, orderBy, limit, updateDoc, where } from '@angular/fire/firestore';
import { collectionData } from '@angular/fire/firestore';
import { serverTimestamp } from 'firebase/firestore';
import { map } from 'rxjs/operators';
import { Observable, from } from 'rxjs';
import { getCountFromServer } from 'firebase/firestore';

import { NotificacionDTO } from '../model/notificacion.model';

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  constructor(private firestore: Firestore) { }

  crearNotificacionCanje(hogarId: string, payload: {
    actorUid: string;
    actorNombre: string;
    recompensaId: string;
    recompensaTitulo: string;
    coste: number;
  }): Promise<void> {
    const colRef = collection(this.firestore, `hogares/${hogarId}/notificaciones`);
    return addDoc(colRef, {
      tipo: 'canje',
      hogarId,
      createdAt: serverTimestamp(),
      actorUid: payload.actorUid,
      actorNombre: payload.actorNombre,
      recompensaId: payload.recompensaId,
      recompensaTitulo: payload.recompensaTitulo,
      coste: payload.coste,
      vistoPor: { [payload.actorUid]: true }
    } as any).then(() => undefined);
  }

  notificaciones$(hogarId: string): Observable<NotificacionDTO[]> {
    const colRef = collection(this.firestore, `hogares/${hogarId}/notificaciones`);
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(30));
    return collectionData(q, { idField: 'id' }) as any;
  }

  notificacionesPendientes$(hogarId: string, uid: string): Observable<NotificacionDTO[]> {
    return this.notificaciones$(hogarId).pipe(
      map(list => (list ?? []).filter(n => !n?.vistoPor?.[uid]))
    );
  }

  canjes$(hogarId: string): Observable<NotificacionDTO[]> {
    return this.notificaciones$(hogarId).pipe(
      map(list => (list ?? []).filter(n => n.tipo === 'canje'))
    );
  }

  marcarComoVista(hogarId: string, notiId: string, uid: string): Promise<void> {
    const ref = doc(this.firestore, `hogares/${hogarId}/notificaciones/${notiId}`);
    return updateDoc(ref, {
      [`vistoPor.${uid}`]: true
    });
  }

  canjesRecientes$(hogarId: string, take: number = 6): Observable<NotificacionDTO[]> {
    const colRef = collection(this.firestore, `hogares/${hogarId}/notificaciones`);
    const q = query(
      colRef,
      where('tipo', '==', 'canje'),
      orderBy('createdAt', 'desc'),
      limit(take)
    );
    return collectionData(q, { idField: 'id' }) as any;
  }

  canjesCount$(hogarId: string): Observable<number> {
    const colRef = collection(this.firestore, `hogares/${hogarId}/notificaciones`);
    const q = query(colRef, where('tipo', '==', 'canje'));
    return from(getCountFromServer(q)).pipe(map(snap => snap.data().count));
  }

  canjesHistorial$(hogarId: string, take: number = 50): Observable<NotificacionDTO[]> {
    const colRef = collection(this.firestore, `hogares/${hogarId}/notificaciones`);
    const q = query(
      colRef,
      where('tipo', '==', 'canje'),
      orderBy('createdAt', 'desc'),
      limit(take)
    );
    return collectionData(q, { idField: 'id' }) as any;
  }

}
