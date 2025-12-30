import { Injectable, inject } from '@angular/core';

import {
  Firestore, collection, query, where, addDoc, serverTimestamp, collectionData, limit, FirestoreDataConverter, DocumentData, doc, setDoc,
  getDoc, runTransaction, arrayRemove, getDocs, writeBatch, docData
} from '@angular/fire/firestore';

import { Auth, authState, User } from '@angular/fire/auth';
import { Observable, of, switchMap, map, catchError, startWith, shareReplay } from 'rxjs';

import { TareasService } from '../../tareas/services/tareas.service';
import { Hogar, TipoHogar } from '../models/hogar.model';
import { EmailService } from '../../../shared/email/email.service';

import {
  SUBDIVISIONS,
  type CountryCode,
  type Subdivisiones,
} from '../../../shared/constants/subdivisiones';
import { detectCountryByNavigator } from '../../../shared/utils/geo';

const normalize = (v: string) =>
  (v || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

function toCountryCode(code: string | null | undefined): CountryCode {
  const up = (code ?? 'ES').toUpperCase();
  return (up in SUBDIVISIONS ? (up as CountryCode) : 'ES');
}

const NAME2CODE_CACHE = new Map<CountryCode, Map<string, string>>();

function codeFromName(cc: CountryCode, name: string): string | undefined {
  const list = SUBDIVISIONS[cc] as readonly Subdivisiones[];
  if (!list?.length) return undefined;

  let m = NAME2CODE_CACHE.get(cc);
  if (!m) {
    m = new Map<string, string>(
      list.map((s: Subdivisiones) => [normalize(s.name), s.code] as const),
    );
    NAME2CODE_CACHE.set(cc, m);
  }
  return m.get(normalize(name));
}

const hogarConverter: FirestoreDataConverter<Hogar> = {
  toFirestore: (hogar: Hogar): DocumentData => (hogar as unknown as DocumentData),
  fromFirestore: (snap) => {
    const d = snap.data() as any;
    return {
      id: snap.id,
      nombre: d.nombre,
      countryCode: (d.countryCode ?? 'ES').toUpperCase(),
      provincia: d.provincia,
      provinciaCode: d.provinciaCode ?? '',
      ownerUid: d.ownerUid ?? d.adminUid ?? '',
      miembros: d.miembros ?? [],
      createdAt: d.createdAt ?? d.creadoEn ?? null,
      tipoHogar: d.tipoHogar,
    } as Hogar;
  },
};

@Injectable({ providedIn: 'root' })
export class HogarService {
  private fs = inject(Firestore);
  private auth = inject(Auth);
  private tareasSvc = inject(TareasService);
  private emailSvc = inject(EmailService);
  private authState$ = authState(this.auth);

  getHogarState$(): Observable<Hogar | null | undefined> {
    return this.getHogar$().pipe(
      startWith(undefined),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  getHogar$(): Observable<Hogar | null> {
    return this.authState$.pipe(
      switchMap(user => {
        if (!user?.uid) return of(null);

        const userRef = doc(this.fs, `usuarios/${user.uid}`);
        return docData(userRef).pipe(
          switchMap((u: any) => {
            const hogarId = u?.hogarId;
            if (!hogarId) return of(null);

            const hogarRef = doc(this.fs, `hogares/${hogarId}`).withConverter(hogarConverter);
            return docData(hogarRef).pipe(
              map(h => (h ? ({ ...h, id: hogarId } as any) : null))
            );
          }),
          catchError(err => {
            console.error('[HogarService.getHogar$] Firestore:', err);
            return of(null);
          })
        );
      })
    );
  }

  async crearHogar(
    nombre: string,
    provincia: string,
    user: User,
    provinciaCode?: string,
    countryCode?: string,
    tipoHogar?: TipoHogar
  ): Promise<{ id: string }> {
    const cc = toCountryCode(countryCode ?? detectCountryByNavigator() ?? 'ES');
    const code = provinciaCode ?? codeFromName(cc, provincia) ?? '';

    const docData: Omit<Hogar, 'id'> = {
      nombre: nombre.trim(),
      countryCode: cc,
      provincia,
      provinciaCode: code,
      ownerUid: user.uid,
      adminUid: user.uid,
      miembros: [user.uid],
      createdAt: serverTimestamp() as any,
      tipoHogar: tipoHogar ?? 'Familiar',
    };

    const ref = await addDoc(collection(this.fs, 'hogares'), docData);

    await setDoc(
      doc(this.fs, `usuarios/${user.uid}`),
      { hogarId: ref.id, actualizadoEn: serverTimestamp() },
      { merge: true }
    );

    await this.tareasSvc.crearTareasPorDefecto(ref.id, user.uid);
    return { id: ref.id };
  }

  async salirDeHogar(hogarId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Debes iniciar sesión');

    const uid = user.uid;
    const hogarRef = doc(this.fs, `hogares/${hogarId}`);
    const preSnap = await getDoc(hogarRef);

    if (!preSnap.exists()) throw new Error('Hogar no encontrado');

    const d = preSnap.data() as any;
    const ownerUid: string = d.ownerUid || d.adminUid;
    if (ownerUid === uid) throw new Error('ADMIN_MUST_TRANSFER');

    const nombreHogar: string = d?.nombre || 'Tu hogar en ZenHogar';

    // === HISTÓRICO: registrar salida de este usuario de este hogar ===
    try {
      await this.registrarHistoricoSalidaUsuario(hogarId, uid, nombreHogar, ownerUid);
    } catch (e) {
      console.warn('No se pudo registrar el histórico al salir del hogar', e);
    }

    await this.tareasSvc.liberarTareasDeUsuarioQueSale(hogarId, uid);
    await this.tareasSvc.cancelarPeticionesPendientesDeUsuarioQueSale(hogarId, uid);
    await this.tareasSvc.limpiarValoracionesPendientesDeUsuarioQueSale(hogarId, uid);
    await this.tareasSvc.cancelarValoracionesDeTareasHechasPorUsuarioQueSale(hogarId, uid);

    const userRef = doc(this.fs, `usuarios/${uid}`);
    await setDoc(userRef, { puntos: 0, hogarId: null, actualizadoEn: serverTimestamp() }, { merge: true });

    await runTransaction(this.fs, async (tx) => {
      const snap = await tx.get(hogarRef);
      if (!snap.exists()) throw new Error('Hogar no encontrado');
      const data = snap.data() as any;
      const ownerUidTx: string = data.ownerUid || data.adminUid;
      if (ownerUidTx === uid) throw new Error('ADMIN_MUST_TRANSFER');

      tx.update(hogarRef, {
        miembros: arrayRemove(uid),
        actualizadoEn: serverTimestamp(),
      });
    });
  }

  async transferirAdmin(hogarId: string, nuevoAdminUid: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Debes iniciar sesión');
    if (!hogarId) throw new Error('HOGAR_ID_REQUERIDO');
    if (!nuevoAdminUid) throw new Error('UID_DESTINO_REQUERIDO');

    const hogarRef = doc(this.fs, `hogares/${hogarId}`);
    const eventosCol = collection(this.fs, `hogares/${hogarId}/eventos`);

    await runTransaction(this.fs, async (tx) => {
      const snap = await tx.get(hogarRef);
      if (!snap.exists()) throw new Error('Hogar no encontrado');

      const d = snap.data() as any;
      const ownerUid: string = d.ownerUid || d.adminUid || '';
      if (!ownerUid) throw new Error('HOGAR_SIN_OWNER');

      if (ownerUid !== user.uid) throw new Error('NOT_ADMIN');

      if (nuevoAdminUid === user.uid) throw new Error('CANNOT_TRANSFER_TO_SELF');

      const miembros: any[] = Array.isArray(d.miembros) ? d.miembros : [];

      const esMiembroDestino = miembros.some(m =>
        typeof m === 'string' ? m === nuevoAdminUid : (m?.uid === nuevoAdminUid)
      );

      if (!esMiembroDestino) throw new Error('USER_NOT_MEMBER');
      tx.update(hogarRef, {
        ownerUid: nuevoAdminUid,
        adminUid: nuevoAdminUid,
        actualizadoEn: serverTimestamp(),
      });

      const eventoRef = doc(eventosCol);
      tx.set(eventoRef, {
        tipo: 'TRANSFER_ADMIN',
        de: user.uid,
        a: nuevoAdminUid,
        ts: serverTimestamp(),
      });
    });
  }

  async eliminarHogar(hogarId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Debes iniciar sesión');
    if (!hogarId) throw new Error('HOGAR_ID_REQUERIDO');

    const hogarRef = doc(this.fs, `hogares/${hogarId}`);
    const snap = await getDoc(hogarRef);
    if (!snap.exists()) throw new Error('Hogar no encontrado');

    const d = snap.data() as any;
    const ownerUid: string = d.ownerUid || d.adminUid || '';
    if (!ownerUid) throw new Error('HOGAR_SIN_OWNER');
    if (ownerUid !== user.uid) throw new Error('NOT_ADMIN');

    // === HISTÓRICO: miembros y nombre del hogar ===
    const miembros: string[] = (Array.isArray(d.miembros) ? d.miembros : [])
      .map((m: any) => (typeof m === 'string' ? m : m?.uid))
      .filter((x: any) => !!x);

    const nombreHogar: string = d?.nombre || 'Tu hogar en ZenHogar';

    try {
      await this.registrarHistoricoHogar(hogarId, miembros, nombreHogar, ownerUid);
    } catch (e) {
      console.warn('No se pudo registrar el histórico del hogar antes de eliminarlo', e);
      // No lanzamos error: no bloqueamos la eliminación del hogar por esto
    }

    // 1) Borrar tareas del hogar en lotes
    const tareasCol = collection(this.fs, 'tareas');
    let tareasDocs: any[] = [];
    try {
      const q = query(tareasCol, where('hogarId', '==', hogarId));
      const s = await getDocs(q);
      tareasDocs = s.docs;
    } catch {
      const s = await getDocs(tareasCol as any);
      tareasDocs = s.docs.filter(dd => (dd.data() as any)?.hogarId === hogarId);
    }
    for (let i = 0; i < tareasDocs.length; i += 450) {
      const slice = tareasDocs.slice(i, i + 450);
      const batch = writeBatch(this.fs);
      slice.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // 2) Borrar subcolección 'eventos'
    try {
      const eventosCol = collection(this.fs, `hogares/${hogarId}/eventos`);
      const evSnap = await getDocs(eventosCol);
      for (let i = 0; i < evSnap.docs.length; i += 450) {
        const slice = evSnap.docs.slice(i, i + 450);
        const batch = writeBatch(this.fs);
        slice.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch { }

    // 2.5) Resetear puntos a 0 de todos los miembros del hogar
    try {
      if (miembros.length > 0) {
        for (let i = 0; i < miembros.length; i += 450) {
          const slice = miembros.slice(i, i + 450);
          const batch = writeBatch(this.fs);
          slice.forEach(uid => {
            const uref = doc(this.fs, `usuarios/${uid}`);
            batch.set(uref, { puntos: 0, hogarId: null, actualizadoEn: serverTimestamp() }, { merge: true });
          });
          await batch.commit();
        }
      }
    } catch (e) {
      console.warn('No se pudieron resetear puntos de todos los miembros', e);
    }

    // 2.6) Borrar colecciones relacionadas (peticiones, invitaciones)
    try {
      await this.deleteByFieldEq('peticionesAsignacion', 'hogarId', hogarId);
      await this.deleteByFieldEq('invitaciones', 'hogarId', hogarId);
    } catch (e) {
      console.warn('No se pudieron borrar todas las colecciones relacionadas', e);
    }

    // 2.7) NOTIFICAR por email a los miembros (no bloquea el borrado si falla)
    try {
      const adminNombre = this.auth.currentUser?.displayName ?? 'Administrador';
      await this.notificarEliminacionHogar(nombreHogar, miembros, adminNombre);
    } catch (e) {
      console.warn('Fallo al notificar por email la eliminación del hogar', e);
    }

    // 3) Borrar el hogar
    await runTransaction(this.fs, async (tx) => {
      const again = await tx.get(hogarRef);
      if (!again.exists()) return;
      const data = again.data() as any;
      const own2: string = data.ownerUid || data.adminUid || '';
      if (own2 !== user.uid) throw new Error('NOT_ADMIN');
      tx.delete(hogarRef);
    });
  }

  private async deleteByFieldEq(
    collectionPath: string,
    field: string,
    value: any,
    chunk = 450
  ): Promise<void> {
    const colRef = collection(this.fs, collectionPath);
    let docs: any[] = [];
    try {
      const q = query(colRef, where(field, '==', value));
      const snap = await getDocs(q);
      docs = snap.docs;
    } catch {
      const snapAll = await getDocs(colRef as any);
      docs = snapAll.docs.filter(d => (d.data() as any)?.[field] === value);
    }

    for (let i = 0; i < docs.length; i += chunk) {
      const slice = docs.slice(i, i + chunk);
      const batch = writeBatch(this.fs);
      slice.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }

  private async notificarEliminacionHogar(
    hogarNombre: string,
    miembrosUids: string[],
    adminNombre?: string | null
  ): Promise<void> {
    try {
      const perfiles = await Promise.all(
        (miembrosUids ?? []).map(async (uid) => {
          const snap = await getDoc(doc(this.fs, `usuarios/${uid}`));
          const u = snap.exists() ? (snap.data() as any) : null;
          return {
            uid,
            email: u?.email ?? null,
            nombre: u?.displayName ?? u?.nombre ?? null,
          };
        })
      );

      const correos = perfiles
        .map(p => p.email)
        .filter((e): e is string => !!e);

      if (!correos.length) return;

      const admin = adminNombre ?? 'Administrador';

      for (const to of correos) {
        await this.emailSvc.enviarAvisoHogarEliminado(to, hogarNombre, admin);
      }
    } catch (e) {
      console.warn('No se pudieron enviar todos los avisos de eliminación de hogar', e);
    }
  }

  private async registrarHistoricoSalidaUsuario(
    hogarId: string,
    uid: string,
    hogarNombre: string,
    ownerUid: string
  ): Promise<void> {
    const tareasCol = collection(this.fs, 'tareas');

    let docs: any[] = [];
    try {
      const q = query(tareasCol, where('hogarId', '==', hogarId));
      const snap = await getDocs(q);
      docs = snap.docs;
    } catch {
      const snapAll = await getDocs(tareasCol as any);
      docs = snapAll.docs.filter(d => (d.data() as any)?.hogarId === hogarId);
    }

    let total = 0;

    for (const docSnap of docs) {
      const t = docSnap.data() as any;
      const hist = Array.isArray(t.historial) ? t.historial : [];

      for (const ev of hist) {
        if (!ev || typeof ev !== 'object') continue;

        const evUid: string | undefined = (ev as any).uid;
        const evHogarId: string | undefined = (ev as any).hogarId || t.hogarId;
        const evCompletada: boolean = (ev as any).completada === true;

        if (!evUid) continue;
        if (evUid !== uid) continue;
        if (evHogarId !== hogarId) continue;
        if (!evCompletada) continue;

        total++;
      }
    }

    const histRef = doc(this.fs, `usuarios/${uid}/historialHogares/${hogarId}`);

    await setDoc(
      histRef,
      {
        hogarId,
        hogarNombre,
        tareasRealizadas: total,
        fechaSalida: serverTimestamp(),
        fueAdmin: ownerUid === uid,
      },
      { merge: true }
    );
  }

  private async registrarHistoricoHogar(
    hogarId: string,
    miembros: string[],
    hogarNombre: string,
    ownerUid: string
  ): Promise<void> {
    if (!miembros || miembros.length === 0) return;

    const tareasCol = collection(this.fs, 'tareas');

    let docs: any[] = [];
    try {
      const q = query(tareasCol, where('hogarId', '==', hogarId));
      const snap = await getDocs(q);
      docs = snap.docs;
    } catch {
      const snapAll = await getDocs(tareasCol as any);
      docs = snapAll.docs.filter(d => (d.data() as any)?.hogarId === hogarId);
    }

    // Mapa uid -> número de "veces que ha completado una tarea" en este hogar
    const counts = new Map<string, number>();

    for (const docSnap of docs) {
      const t = docSnap.data() as any;
      const hist = Array.isArray(t.historial) ? t.historial : [];

      for (const ev of hist) {
        if (!ev || typeof ev !== 'object') continue;

        const evUid: string | undefined = (ev as any).uid;
        const evHogarId: string | undefined = (ev as any).hogarId || t.hogarId;
        const evCompletada: boolean = (ev as any).completada === true;

        if (!evUid) continue;
        if (evHogarId !== hogarId) continue;
        if (!evCompletada) continue;

        counts.set(evUid, (counts.get(evUid) ?? 0) + 1);
      }
    }

    // Guardamos histórico por cada miembro
    for (const uid of miembros) {
      const total = counts.get(uid) ?? 0;

      const histRef = doc(this.fs, `usuarios/${uid}/historialHogares/${hogarId}`);
      await setDoc(
        histRef,
        {
          hogarId,
          hogarNombre,
          tareasRealizadas: total,
          fechaSalida: serverTimestamp(),
          fueAdmin: ownerUid === uid,
        },
        { merge: true }
      );
    }
  }

}
