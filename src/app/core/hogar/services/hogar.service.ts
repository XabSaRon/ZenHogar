import { Injectable, inject } from '@angular/core';
import { Hogar } from '../models/hogar.model';
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
import { PROVINCIAS_INE } from '../../../shared/constants/provincias';

const hogarConverter: FirestoreDataConverter<Hogar> = {
  toFirestore: (hogar: Hogar): DocumentData =>
    (hogar as unknown as DocumentData),
  fromFirestore: (snap) => {
    const d = snap.data() as any;
    return {
      id: snap.id,
      nombre: d.nombre,
      provincia: d.provincia,
      provinciaCode: d.provinciaCode ?? '',
      ownerUid: d.ownerUid ?? d.adminUid ?? '',
      miembros: d.miembros ?? [],
      createdAt: d.createdAt ?? d.creadoEn ?? null,
      tipoHogar: d.tipoHogar,
    } as Hogar;
  },
};

const NAME2CODE = new Map(PROVINCIAS_INE.map(p => [normalize(p.name), p.code]));
function normalize(v: string) {
  return (v || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

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
    provinciaCode?: string
  ): Promise<{ id: string }> {
    const code = provinciaCode ?? NAME2CODE.get(normalize(provincia)) ?? '';

    const docData: Omit<Hogar, 'id'> = {
      nombre: nombre.trim(),
      provincia,
      provinciaCode: code,
      ownerUid: user.uid,
      miembros: [user.uid],
      createdAt: serverTimestamp() as any,
      tipoHogar: 'Familiar',
    };

    const ref = await addDoc(collection(this.fs, 'hogares'), docData);
    await this.tareasSvc.crearTareasPorDefecto(ref.id, user.uid);
    return { id: ref.id };
  }
}
