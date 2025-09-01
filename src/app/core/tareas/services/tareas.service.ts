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
  increment,
  addDoc,
} from '@angular/fire/firestore';
import { inject, Injectable } from '@angular/core';
import { Observable, combineLatest, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { Tarea, TareaDTO } from '../models/tarea.model';
import { tareaConverter } from '../utilidades/tarea.converter';
import { TAREAS_POR_DEFECTO } from '../utilidades/tareas-default';
import { Usuario } from '../../usuarios/models/usuario.model';
import { AuthService } from '../../auth/auth.service';
import { PUNTOS_POR_VALORACION, PENALIZACION_ABANDONO } from '../utilidades/tareas.constants';
import { PeticionAsignacionDTO } from '../models/peticion-asignacion.model';

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
    return PUNTOS_POR_VALORACION[rating] ?? 0;
  }

  private mediaValoraciones(valoraciones: { puntos: number }[]): number {
    if (!valoraciones.length) return 0;
    const sum = valoraciones.reduce((s, v) => s + (v.puntos ?? 0), 0);
    return Math.round(sum / valoraciones.length);
  }

  private esEnCurso(t: Tarea): boolean {
    const pendientes = (t.valoracionesPendientes?.length ?? 0) > 0;
    return !!t.asignadA && !t.completada && !pendientes && !t.bloqueadaHastaValoracion;
  }

  // ---- Queries ----
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

  async asignarTarea(tareaId: string, nuevoUid: string, penalizacionAbandono: number = PENALIZACION_ABANDONO): Promise<void> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      throw new Error('Modo demo: no se puede asignar tarea.');
    }

    const tareaRef = doc(this.fs, 'tareas', tareaId);
    const tareaSnap = await getDoc(tareaRef);
    if (!tareaSnap.exists()) {
      throw new Error('Tarea no encontrada');
    }

    const tareaActual = tareaSnap.data() as Tarea;
    const historialActual = [...(tareaActual.historial ?? [])];

    const enCurso = this.esEnCurso(tareaActual);
    const soyAsignado = tareaActual.asignadA === currentUser.uid;

    if (enCurso && !soyAsignado) {
      throw new Error('Solo quien la tiene en curso puede reasignar.');
    }

    if (!nuevoUid) {
      const ahoraIso = new Date().toISOString();
      const penaliza = enCurso && soyAsignado && penalizacionAbandono !== 0;

      if (tareaActual.asignadA && tareaActual.asignadoNombre) {
        const nuevaEntrada: any = {
          uid: tareaActual.asignadA,
          nombre: tareaActual.asignadoNombre,
          fotoURL: tareaActual.asignadoFotoURL || '',
          fecha: ahoraIso,
          completada: tareaActual.completada || false,
          hogarId: tareaActual.hogarId,
        };

        if (penaliza) {
          nuevaEntrada.puntosOtorgados = penalizacionAbandono;
          nuevaEntrada.fechaOtorgados = ahoraIso;
          nuevaEntrada.motivo = 'abandono';
        }

        await updateDoc(tareaRef, {
          asignadA: null,
          asignadoNombre: null,
          asignadoFotoURL: null,
          historial: [...historialActual, nuevaEntrada],
        });
      } else {
        await updateDoc(tareaRef, {
          asignadA: null,
          asignadoNombre: null,
          asignadoFotoURL: null,
        });
      }

      if (penaliza) {
        await this.registrarPenalizacionAbandono(tareaActual, currentUser.uid, penalizacionAbandono);
      }

      return;
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

    await updateDoc(tareaRef, {
      asignadA: nuevoUid,
      asignadoNombre: user.nombre,
      asignadoFotoURL: user.photoURL || null,
      historial: historialActual,
    });
  }

  async registrarPenalizacionAbandono(tarea: Tarea, uid: string, puntos: number): Promise<void> {
    if (!uid || !tarea?.hogarId) return;
    const usuarioRef = doc(this.fs, 'usuarios', uid);
    await updateDoc(usuarioRef, { puntos: increment(puntos) });
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

  async crearPeticionAsignacion(data: {
    tareaId: string;
    hogarId: string;
    deUid: string;
    paraUid: string;
  }): Promise<void> {
    const { tareaId, hogarId, deUid, paraUid } = data;

    if (!deUid || !paraUid || !tareaId || !hogarId) {
      throw new Error('Datos incompletos para crear petición.');
    }
    if (deUid === paraUid) {
      throw new Error('La petición a uno mismo no es necesaria.');
    }

    const colRef = collection(this.fs, 'peticionesAsignacion');
    const deSnap = await getDoc(doc(this.fs, 'usuarios', deUid));
    const paraSnap = await getDoc(doc(this.fs, 'usuarios', paraUid));
    const deNombre = deSnap.exists() ? ((deSnap.data() as Usuario).nombre ?? '') : '';
    const paraNombre = paraSnap.exists() ? ((paraSnap.data() as Usuario).nombre ?? '') : '';

    const payload = {
      tareaId,
      hogarId,
      deUid,
      paraUid,
      deNombre,
      paraNombre,
      estado: 'pendiente' as const,
      fecha: new Date().toISOString(),
    };

    try {
      await addDoc(colRef, payload);
    } catch (e: any) {
      console.error('Error creando petición:', e?.code, e?.message, payload);
      throw e;
    }
  }

  peticionesPendientesPara$(uid: string): Observable<PeticionAsignacionDTO[]> {
    if (!uid) return of([]);
    const colRef = collection(this.fs, 'peticionesAsignacion');
    const qy = query(colRef, where('paraUid', '==', uid), where('estado', '==', 'pendiente'));
    return collectionData(qy, { idField: 'id' }) as Observable<PeticionAsignacionDTO[]>;
  }

  peticionesPendientesEnHogar$(hogarId: string): Observable<PeticionAsignacionDTO[]> {
    const colRef = collection(this.fs, 'peticionesAsignacion');
    const qy = query(colRef, where('hogarId', '==', hogarId), where('estado', '==', 'pendiente'));
    return collectionData(qy, { idField: 'id' }) as Observable<PeticionAsignacionDTO[]>;
  }

  async aceptarPeticion(peticionId: string): Promise<void> {
    const petRef = doc(this.fs, 'peticionesAsignacion', peticionId);
    const petSnap = await getDoc(petRef);
    if (!petSnap.exists()) throw new Error('Petición no encontrada');

    const pet = petSnap.data() as PeticionAsignacionDTO;
    if (pet.estado !== 'pendiente') {
      throw new Error('La petición ya fue procesada.');
    }

    const tareaRef = doc(this.fs, 'tareas', pet.tareaId);
    const tareaSnap = await getDoc(tareaRef);
    if (!tareaSnap.exists()) throw new Error('Tarea no encontrada');

    const tarea = tareaSnap.data() as Tarea;

    if (tarea.bloqueadaHastaValoracion || (tarea.valoracionesPendientes?.length ?? 0) > 0) {
      throw new Error('No se puede reasignar hasta completar las valoraciones.');
    }

    const usuarioRef = doc(this.fs, 'usuarios', pet.paraUid);
    const usuarioSnap = await getDoc(usuarioRef);
    if (!usuarioSnap.exists()) throw new Error('Usuario destino no encontrado');

    const user = usuarioSnap.data() as Usuario;

    const batch = writeBatch(this.fs);

    const historialActual = [...(tarea.historial ?? [])];
    if (tarea.asignadA && tarea.asignadoNombre) {
      historialActual.push({
        uid: tarea.asignadA,
        nombre: tarea.asignadoNombre,
        fotoURL: tarea.asignadoFotoURL || '',
        fecha: new Date().toISOString(),
        completada: tarea.completada || false,
        hogarId: tarea.hogarId,
      });
    }

    batch.update(tareaRef, {
      asignadA: pet.paraUid,
      asignadoNombre: user.nombre,
      asignadoFotoURL: user.photoURL || null,
      historial: historialActual,
    });

    batch.update(petRef, {
      estado: 'aceptada',
      aceptadaEn: serverTimestamp(),
      aceptadaPorUid: pet.paraUid,
      aceptadaPorNombre: user.nombre ?? null,
      aceptacionNotificadaSolicitante: false,
    });

    await batch.commit();
  }

  async rechazarPeticion(peticionId: string): Promise<void> {
    const petRef = doc(this.fs, 'peticionesAsignacion', peticionId);
    const petSnap = await getDoc(petRef);
    if (!petSnap.exists()) throw new Error('Petición no encontrada');

    const pet = petSnap.data() as PeticionAsignacionDTO;
    if (pet.estado !== 'pendiente') {
      throw new Error('La petición ya fue procesada.');
    }

    const usuarioRef = doc(this.fs, 'usuarios', pet.paraUid);
    const usuarioSnap = await getDoc(usuarioRef);
    const rechazador = usuarioSnap.exists() ? (usuarioSnap.data() as Usuario) : undefined;

    await updateDoc(petRef, {
      estado: 'rechazada',
      rechazadaEn: serverTimestamp(),
      rechazadaPorUid: pet.paraUid,
      rechazadaPorNombre: rechazador?.nombre ?? null,
      rechazoNotificadoSolicitante: false,
    });
  }

  rechazosParaSolicitante$(uidSolicitante: string): Observable<PeticionAsignacionDTO[]> {
    if (!uidSolicitante) return of([]);
    const colRef = collection(this.fs, 'peticionesAsignacion');
    const qy = query(
      colRef,
      where('deUid', '==', uidSolicitante),
      where('estado', '==', 'rechazada'),
      where('rechazoNotificadoSolicitante', '==', false)
    );
    return collectionData(qy, { idField: 'id' }) as Observable<PeticionAsignacionDTO[]>;
  }

  async marcarRechazoNotificado(peticionId: string): Promise<void> {
    const ref = doc(this.fs, 'peticionesAsignacion', peticionId);
    await updateDoc(ref, {
      rechazoNotificadoSolicitante: true,
      rechazoNotificadoSolicitanteEn: serverTimestamp(),
    });
  }

  aceptadasParaSolicitante$(uidSolicitante: string): Observable<PeticionAsignacionDTO[]> {
    if (!uidSolicitante) return of([]);
    const colRef = collection(this.fs, 'peticionesAsignacion');
    const qy = query(colRef, where('deUid', '==', uidSolicitante), where('estado', '==', 'aceptada'));
    return (collectionData(qy, { idField: 'id' }) as Observable<PeticionAsignacionDTO[]>)
      .pipe(map(list => (list ?? []).filter(p => p.aceptacionNotificadaSolicitante !== true)));
  }

  async marcarAceptacionNotificada(peticionId: string): Promise<void> {
    const ref = doc(this.fs, 'peticionesAsignacion', peticionId);
    await updateDoc(ref, {
      aceptacionNotificadaSolicitante: true,
      aceptacionNotificadaSolicitanteEn: serverTimestamp(),
    });
  }

  async crearTarea(data: {
    nombre: string;
    descripcion?: string;
    hogarId: string;
    personalizada: boolean;
    asignadA?: string | null;
    peso?: number;
  }): Promise<string> {
    const colRef = collection(this.fs, 'tareas').withConverter(tareaConverter);

    const payload: Omit<Tarea, 'id'> = {
      nombre: data.nombre,
      descripcion: data.descripcion ?? '',
      completada: false,
      asignadA: data.asignadA ?? null,
      hogarId: data.hogarId,
      createdAt: serverTimestamp(),
      asignadoNombre: null,
      asignadoFotoURL: null,
      peso: data.peso,
      historial: [],
      valoraciones: [],
      valoracionesPendientes: [],
      bloqueadaHastaValoracion: false,
      personalizada: data.personalizada,
    };

    const ref = await addDoc(colRef, payload);
    return ref.id;
  }

}
