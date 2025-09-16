import { Injectable, inject } from '@angular/core';
import { Hogar, TipoHogar } from '../models/hogar.model';
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
}
