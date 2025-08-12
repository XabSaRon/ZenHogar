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
  deleteField,
  increment
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

  private getWeekStart(d = new Date()): Date {
    const weekStart = new Date(d);
    const day = weekStart.getDay() || 7;
    if (day !== 1) weekStart.setDate(weekStart.getDate() - (day - 1));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  private puntosBaseFromRating(rating: number): number {
    switch (rating) {
      case 5: return 10;
      case 4: return 5;
      case 3: return 0;
      case 2: return -5;
      case 1: return -10;
      default: return 0;
    }
  }

  private mediaValoraciones(valoraciones: { puntos: number }[]): number {
    if (!valoraciones.length) return 0;
    const sum = valoraciones.reduce((s, v) => s + (v.puntos ?? 0), 0);
    return Math.round(sum / valoraciones.length);
  }

  getTareasPorHogar(hogarId: string, enrich: boolean = true): Observable<TareaDTO[]> {
    const tareasRef = collection(this.fs, 'tareas').withConverter(tareaConverter);
    const q = query(tareasRef, where('hogarId', '==', hogarId));

    return collectionData(q, { idField: 'id' }).pipe(
      switchMap((tareas: Tarea[]) => {
        if (!enrich) {
          return of(tareas.map<TareaDTO>(t => ({
            ...t,
            asignadoNombre: t.asignadoNombre ?? '',
            asignadoFotoURL: t.asignadoFotoURL ?? ''
          })));
        }

        const uids = [...new Set(tareas.map(t => t.asignadA).filter(Boolean))];
        if (uids.length === 0) {
          return of(tareas.map<TareaDTO>(t => ({
            ...t,
            asignadoNombre: '',
            asignadoFotoURL: ''
          })));
        }

        const perfiles$ = uids
          .filter((uid): uid is string => typeof uid === 'string')
          .map(uid =>
            docData<DocumentData>(doc(this.fs, 'usuarios', uid)).pipe(
              map(perfil => ({
                uid,
                nombre: perfil?.['displayName'] ?? perfil?.['nombre'] ?? perfil?.['email'] ?? 'Desconocido',
                fotoURL: perfil?.['photoURL'] ?? '',
              }))
            )
          );

        return combineLatest(perfiles$).pipe(
          map(perfiles => {
            const mapa = Object.fromEntries(perfiles.map(p => [p.uid, p]));
            return tareas.map<TareaDTO>(t => ({
              ...t,
              asignadoNombre: t.asignadA ? (mapa[t.asignadA]?.nombre ?? '') : '',
              asignadoFotoURL: t.asignadA ? (mapa[t.asignadA]?.fotoURL ?? '') : '',
            }));
          })
        );
      })
    );
  }

  getTareasAsignadasUsuario(hogarId: string, uid: string): Observable<TareaDTO[]> {
    if (!uid) return of([]);
    return this.getTareasPorHogar(hogarId).pipe(
      map(tareas => tareas.filter(t => t.asignadA === uid))
    );
  }

  getPuntosSemana(hogarId: string, uid: string): Observable<number> {
    if (!uid) return of(0);
    const weekStart = this.getWeekStart();

    return this.getTareasPorHogar(hogarId).pipe(
      map((tareas) => {
        return (tareas || []).reduce((acc, t) => {
          if (!Array.isArray(t.historial) || t.historial.length === 0) return acc;

          const puntos = t.historial.reduce((sum, h) => {
            if (h.uid !== uid) return sum;
            if (typeof h.puntosOtorgados !== 'number') return sum;
            const fecha = new Date(h.fechaOtorgados ?? h.fecha);
            if (isNaN(+fecha) || fecha < weekStart) return sum;
            return sum + h.puntosOtorgados;
          }, 0);

          return acc + puntos;
        }, 0);
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
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return Promise.reject(new Error('Modo demo: no se puede asignar tarea.'));
    }

    const tareaRef = doc(this.fs, 'tareas', tareaId);

    return getDoc(tareaRef).then(async (tareaSnap) => {
      const tareaActual = tareaSnap.data() as Tarea;
      const historialActual = [...(tareaActual.historial ?? [])];

      if (!nuevoUid) {
        if (tareaActual.asignadA && tareaActual.asignadoNombre) {
          const nuevaEntrada = {
            uid: tareaActual.asignadA,
            nombre: tareaActual.asignadoNombre,
            fotoURL: tareaActual.asignadoFotoURL || '',
            fecha: new Date().toISOString(),
            completada: tareaActual.completada || false,
            hogarId: tareaActual.hogarId,
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
        historialActual.push({
          uid: tareaActual.asignadA,
          nombre: tareaActual.asignadoNombre,
          fotoURL: tareaActual.asignadoFotoURL || '',
          fecha: new Date().toISOString(),
          completada: tareaActual.completada || false,
          hogarId: tareaActual.hogarId,
        });
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
    if (!uidActual) {
      return Promise.reject(new Error('Modo demo: no se puede valorar tarea.'));
    }

    const tareaRef = doc(this.fs, 'tareas', tareaId);

    return getDoc(tareaRef).then(async (snap) => {
      if (!snap.exists()) throw new Error('Tarea no encontrada');

      const tarea = snap.data() as Tarea;
      const valoraciones = [...(tarea.valoraciones ?? [])];
      const pendientes = [...(tarea.valoracionesPendientes ?? [])];

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
        bloqueadaHastaValoracion: nuevasPendientes.length > 0,
      };

      if (nuevasPendientes.length === 0) {
        const media = this.mediaValoraciones(valoraciones);
        const pesoUsado = tarea.peso ?? 1;
        const base = this.puntosBaseFromRating(media);
        const puntosOtorgados = base * pesoUsado;

        const historial = [...(tarea.historial ?? [])];
        const ultimo = historial[historial.length - 1];

        if (ultimo?.uid) {
          const usuarioRef = doc(this.fs, 'usuarios', ultimo.uid);
          await updateDoc(usuarioRef, { puntos: increment(puntosOtorgados) });

          historial[historial.length - 1] = {
            ...ultimo,
            puntosOtorgados,
            pesoUsado,
            puntuacionFinal: media,
            fechaOtorgados: new Date().toISOString(),
          };

          (actualizaciones as any).historial = historial;
        }

        (actualizaciones as any).asignadA = deleteField();
        (actualizaciones as any).asignadoNombre = deleteField();
        (actualizaciones as any).asignadoFotoURL = deleteField();
        actualizaciones.completada = false;
      }

      return updateDoc(tareaRef, actualizaciones);
    });
  }
}
