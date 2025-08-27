import { Injectable, inject } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  authState,
  User,
} from '@angular/fire/auth';
import {
  Firestore,
  serverTimestamp,
  doc,
  docData,
} from '@angular/fire/firestore';
import { Observable, of, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { Usuario } from '../usuarios/models/usuario.model';

import { firebaseAuthWrapper } from './firebase-auth-wrapper';
import { firestoreWrapper } from './firestore-wrapper';

export type UsuarioPublico = {
  displayName?: string | null;
  photoURL?: string | null;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private fs = inject(Firestore);

  user$: Observable<User | null> = authState(this.auth);
  usuarioCompleto$: Observable<Usuario | null>;

  public uidActual: string | null = null;

  constructor() {
    this.user$.subscribe(user => {
      this.uidActual = user?.uid ?? null;
    });

    this.usuarioCompleto$ = this.user$.pipe(
      switchMap(user => {
        if (!user) return of(null);
        const ref = doc(this.fs, 'usuarios', user.uid);
        return docData(ref) as Observable<Usuario>;
      })
    );
  }

  get currentUser(): User | null {
    return this.auth.currentUser;
  }

  async loginGoogle() {
    const { user } = await firebaseAuthWrapper.signInWithPopup(this.auth, new GoogleAuthProvider());

    const ref = firestoreWrapper.doc(this.fs, `usuarios/${user.uid}`);
    await firestoreWrapper.setDoc(
      ref,
      {
        nombre: user.displayName ?? '',
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        photoURL: user.photoURL ?? '',
        lastLogin: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  logout() {
    return firebaseAuthWrapper.signOut(this.auth);
  }

  getUsuarioPublico$(uid: string): Observable<UsuarioPublico | null> {
    if (!uid) return of(null);
    const ref = doc(this.fs, 'usuarios', uid);
    return docData(ref).pipe(
      map((u: any) => {
        if (!u) return null;
        return {
          displayName: u.displayName ?? u.nombre ?? null,
          photoURL: u.photoURL ?? null,
        } as UsuarioPublico;
      })
    );
  }
}

