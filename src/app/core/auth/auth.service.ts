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
import { Usuario } from '../usuarios/models/usuario.model';

import { firebaseAuthWrapper } from './firebase-auth-wrapper';
import { firestoreWrapper } from './firestore-wrapper';

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
}
