import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  addDoc,
  serverTimestamp,
  collectionData,
  FirestoreDataConverter,
  DocumentData,
} from '@angular/fire/firestore';
import { Auth, authState, User } from '@angular/fire/auth';
import { Observable, of, switchMap, map } from 'rxjs';

export interface Hogar {
  id?: string;
  nombre: string;
  adminUid: string;
  miembros: string[];
  creadoEn: any;
}

const hogarConverter: FirestoreDataConverter<Hogar> = {
  toFirestore: (hogar: Hogar): DocumentData => hogar,
  fromFirestore: (snap) =>
    ({ id: snap.id, ...(snap.data() as DocumentData) } as Hogar),
};

@Injectable({ providedIn: 'root' })
export class HogarService {
  private fs = inject(Firestore);
  private auth = inject(Auth);

  getHogar$(): Observable<Hogar | null> {
    return authState(this.auth).pipe(
      switchMap((user) => {
        if (!user) return of(null);

        const q = query(
          collection(this.fs, 'hogares').withConverter(hogarConverter),
          where('miembros', 'array-contains', user.uid)
        );

        return collectionData<Hogar>(q).pipe(
          map((arr) => (arr.length ? arr[0] : null))
        );
      })
    );
  }

  async crearHogar(nombre: string, user: User): Promise<{ id: string }> {
    const ref = await addDoc(collection(this.fs, 'hogares'), {
      nombre,
      adminUid: user.uid,
      miembros: [user.uid],
      creadoEn: serverTimestamp(),
    });
    return { id: ref.id };
  }

  async getOrCreateHogar(nombre = 'Mi hogar'): Promise<string> {
    const user = this.auth.currentUser!;
    if (!user) throw new Error('No hay usuario autenticado');
    const existente = await this.getHogar$().pipe(map((h) => h)).toPromise();
    return existente ? existente.id! : (await this.crearHogar(nombre, user)).id;
  }
}

