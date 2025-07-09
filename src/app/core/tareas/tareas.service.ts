import {
  Firestore,
  collection,
  query,
  where,
  collectionData,
  doc,
  docData,
  DocumentData,
  addDoc,
  writeBatch,
  serverTimestamp
} from '@angular/fire/firestore';
import { inject, Injectable } from '@angular/core';
import { Observable, combineLatest, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { Tarea, TareaDTO } from './tarea.model';
import { tareaConverter } from './tarea.converter';
import { TAREAS_POR_DEFECTO } from './utilidades/tareas-default';

@Injectable({ providedIn: 'root' })
export class TareasService {
  private fs = inject(Firestore);

  getTareasPorHogar(hogarId: string): Observable<TareaDTO[]> {
    const tareasRef = collection(this.fs, 'tareas')
      .withConverter(tareaConverter);
    const q = query(tareasRef, where('hogarId', '==', hogarId));

    return collectionData(q, { idField: 'id' }).pipe(
      switchMap((tareas: Tarea[]) => {
        const uids = [...new Set(tareas.map(t => t.asignadA).filter(Boolean))];

        if (uids.length === 0) {
          return of(
            tareas.map<TareaDTO>(t => ({ ...t, asignadoNombre: '' }))
          );
        }

        const perfiles$ = uids
          .filter((uid): uid is string => typeof uid === 'string')
          .map(uid =>
            docData<DocumentData>(doc(this.fs, 'usuarios', uid)).pipe(
              map(perfil => ({
                uid,
                nombre:
                  perfil?.['displayName'] ??
                  perfil?.['nombre'] ??
                  perfil?.['email'] ??
                  'Desconocido',
                fotoURL: perfil?.['photoURL'] ?? '',
              }))
            )
          );

        return combineLatest(perfiles$).pipe(
          map(perfiles => {
            const mapa = Object.fromEntries(perfiles.map(p => [p.uid, p]));

            return tareas.map<TareaDTO>(t => ({
              ...t,
              asignadoNombre: t.asignadA ? mapa[t.asignadA]?.nombre ?? '' : '',
              asignadoFotoURL: t.asignadA ? mapa[t.asignadA]?.fotoURL ?? '' : '',
            }));
          })
        );

      })
    );
  }

  crearTareasPorDefecto(hogarId: string, adminUid: string) {
    const batch = writeBatch(this.fs);
    const colRef = collection(this.fs, 'tareas').withConverter(tareaConverter);

    TAREAS_POR_DEFECTO.forEach(t => {
      const ref = doc(colRef);
      batch.set(ref, {
        ...t,
        hogarId,
        createdAt: serverTimestamp(),
      });
    });

    return batch.commit();
  }
}
