import {
  Firestore,
  collection,
  query,
  where,
  collectionData,
  doc,
  docData,
  DocumentData,
  updateDoc,
  getDoc,
  writeBatch,
  serverTimestamp,
  deleteField
} from '@angular/fire/firestore';
import { inject, Injectable } from '@angular/core';
import { Observable, combineLatest, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { Tarea, TareaDTO } from '../models/tarea.model';
import { tareaConverter } from '../utilidades/tarea.converter';
import { TAREAS_POR_DEFECTO } from '../utilidades/tareas-default';
import { Usuario } from '../../usuarios/models/usuario.model';
import { AuthService } from '../../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class TareasService {
  private fs = inject(Firestore);
  private authService = inject(AuthService);

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

  asignarTarea(tareaId: string, nuevoUid: string): Promise<void> {
    const tareaRef = doc(this.fs, 'tareas', tareaId);

    return getDoc(tareaRef).then(async (tareaSnap) => {
      const tareaActual = tareaSnap.data() as Tarea;
      const historialActual = tareaActual.historial ?? [];

      if (!nuevoUid) {
        if (tareaActual.asignadA && tareaActual.asignadoNombre) {
          const nuevaEntrada = {
            uid: tareaActual.asignadA,
            nombre: tareaActual.asignadoNombre,
            fotoURL: tareaActual.asignadoFotoURL || '',
            fecha: new Date().toISOString(),
            completada: tareaActual.completada || false,
          };

          return updateDoc(tareaRef, {
            asignadA: null,
            asignadoNombre: null,
            asignadoFotoURL: null,
            historial: [...historialActual, nuevaEntrada],
          });
        } else {
          return updateDoc(tareaRef, {
            asignadA: null,
            asignadoNombre: null,
            asignadoFotoURL: null,
          });
        }
      }

      if (tareaActual.asignadA && tareaActual.asignadoNombre) {
        const nuevaEntrada = {
          uid: tareaActual.asignadA,
          nombre: tareaActual.asignadoNombre,
          fotoURL: tareaActual.asignadoFotoURL || '',
          fecha: new Date().toISOString(),
          completada: tareaActual.completada || false,
        };
        historialActual.push(nuevaEntrada);
      }

      const usuarioRef = doc(this.fs, 'usuarios', nuevoUid);
      const snap = await getDoc(usuarioRef);
      if (!snap.exists()) throw new Error('Usuario no encontrado');

      const user = snap.data() as Usuario;

      return updateDoc(tareaRef, {
        asignadA: nuevoUid,
        asignadoNombre: user.nombre,
        asignadoFotoURL: user.photoURL || null,
        historial: historialActual,
      });
    });
  }

  valorarTarea(tareaId: string, puntuacion: number, comentario: string, uidActual: string): Promise<void> {
    const tareaRef = doc(this.fs, 'tareas', tareaId);

    return getDoc(tareaRef).then((snap) => {
      if (!snap.exists()) throw new Error('Tarea no encontrada');
      if (!uidActual) throw new Error('Usuario no autenticado');

      const tarea = snap.data() as Tarea;
      const valoraciones = tarea.valoraciones ?? [];
      const pendientes = tarea.valoracionesPendientes ?? [];

      valoraciones.push({
        uid: uidActual,
        puntos: puntuacion,
        comentario,
        fecha: new Date().toISOString(),
      });

      const nuevasPendientes = pendientes.filter(uid => uid !== uidActual);

      const actualizaciones: Partial<Tarea> = {
        valoraciones,
        valoracionesPendientes: nuevasPendientes,
        bloqueadaHastaValoracion: false,
      };

      if (nuevasPendientes.length === 0) {
        (actualizaciones as any).asignadA = deleteField();
        (actualizaciones as any).asignadoNombre = deleteField();
        (actualizaciones as any).asignadoFotoURL = deleteField();
        actualizaciones.completada = false;
      }

      return updateDoc(tareaRef, actualizaciones);
    });
  }

}
