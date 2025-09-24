import { Injectable, inject } from '@angular/core';
import { Hogar, TipoHogar } from '../models/hogar.model';
import { EmailService } from '../../../shared/email/email.service';

import {
  Firestore,
  collection,
  query,
  where,
  addDoc,
  serverTimestamp,
  collectionData,
  limit,
  FirestoreDataConverter,
  DocumentData,
  doc,
  setDoc,
  getDoc,
  runTransaction,
  arrayRemove,
  getDocs,
  writeBatch,
} from '@angular/fire/firestore';

import { Auth, authState, User } from '@angular/fire/auth';
import { Observable, of, switchMap, map } from 'rxjs';
import { TareasService } from '../../tareas/services/tareas.service';

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
  private emailSvc = inject(EmailService)

  getHogar$(): Observable<Hogar | null> {
    return authState(this.auth).pipe(
      switchMap(user => {
        if (!user) return of(null);

        const q = query(
          collection(this.fs, 'hogares').withConverter(hogarConverter),
          where('miembros', 'array-contains', user.uid),
          limit(1)
        );

        return collectionData<Hogar>(q).pipe(
          map(arr => arr[0] ?? null)
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
      miembros: [user.uid],
      createdAt: serverTimestamp() as any,
      tipoHogar: tipoHogar ?? 'Familiar',
    };

    const ref = await addDoc(collection(this.fs, 'hogares'), docData);
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
    {
      const d = preSnap.data() as any;
      const ownerUid: string = d.ownerUid || d.adminUid;
      if (ownerUid === uid) throw new Error('ADMIN_MUST_TRANSFER');
    }

    const tareasCol = collection(this.fs, 'tareas');
    let tareasDocs: any[] = [];
    try {
      const q = query(tareasCol, where('hogarId', '==', hogarId), where('asignadA', '==', uid));
      const snap = await getDocs(q);
      tareasDocs = snap.docs;
    } catch {
      const q1 = query(tareasCol, where('asignadA', '==', uid));
      const s1 = await getDocs(q1);
      tareasDocs = s1.docs.filter(d => (d.data() as any)?.hogarId === hogarId);
    }
    if (tareasDocs.length > 0) {
      for (let i = 0; i < tareasDocs.length; i += 450) {
        const slice = tareasDocs.slice(i, i + 450);
        const batch = writeBatch(this.fs);
        slice.forEach(d => {
          batch.update(d.ref, {
            asignadA: null,
            asignadoNombre: null,
            asignadoFotoURL: null,
            completada: false,
            valoracionesPendientes: []
          });
        });
        await batch.commit();
      }
    }

    const userRef = doc(this.fs, `usuarios/${uid}`);
    await setDoc(userRef, { puntos: 0, actualizadoEn: serverTimestamp() }, { merge: true });

    await runTransaction(this.fs, async (tx) => {
      const snap = await tx.get(hogarRef);
      if (!snap.exists()) throw new Error('Hogar no encontrado');
      const data = snap.data() as any;
      const ownerUid: string = data.ownerUid || data.adminUid;
      if (ownerUid === uid) throw new Error('ADMIN_MUST_TRANSFER');

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
    let miembros: string[] = [];
    try {
      miembros = (Array.isArray(d.miembros) ? d.miembros : [])
        .map((m: any) => (typeof m === 'string' ? m : m?.uid))
        .filter((x: any) => !!x);

      for (let i = 0; i < miembros.length; i += 450) {
        const slice = miembros.slice(i, i + 450);
        const batch = writeBatch(this.fs);
        slice.forEach(uid => {
          const uref = doc(this.fs, `usuarios/${uid}`);
          batch.set(uref, { puntos: 0, actualizadoEn: serverTimestamp() }, { merge: true });
        });
        await batch.commit();
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
      await this.notificarEliminacionHogar(d?.nombre || 'Tu hogar en ZenHogar', miembros, adminNombre);
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

}
