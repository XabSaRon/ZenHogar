import { Injectable, inject } from '@angular/core';
import { Auth, GoogleAuthProvider, authState, idToken, User } from '@angular/fire/auth';
import { Firestore, serverTimestamp, doc, docData } from '@angular/fire/firestore';
import { Observable, of, switchMap, catchError, combineLatest, shareReplay, distinctUntilChanged } from 'rxjs';
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

  private loginEnCurso = false;

  user$: Observable<User | null> = authState(this.auth).pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private token$ = idToken(this.auth).pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  public uidActual: string | null = null;

  usuarioCompleto$: Observable<Usuario | null> = combineLatest([this.user$, this.token$]).pipe(
    map(([user, token]) => ({ uid: user?.uid ?? null, token: token ?? null })),
    distinctUntilChanged((a, b) => a.uid === b.uid && a.token === b.token),
    switchMap(({ uid, token }) => {
      if (!uid || !token) return of(null);

      const ref = doc(this.fs, `usuarios/${uid}`);
      return (docData(ref) as Observable<Usuario>).pipe(
        catchError(err => {
          console.error('[AuthService.usuarioCompleto$] Firestore:', err);
          return of(null);
        })
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor() {
    this.user$.subscribe(user => {
      this.uidActual = user?.uid ?? null;
    });
  }

  get currentUser(): User | null {
    return this.auth.currentUser;
  }

  async loginGoogle() {
    if (this.loginEnCurso) return;
    this.loginEnCurso = true;

    try {
      const { user } = await firebaseAuthWrapper.signInWithPopup(
        this.auth,
        new GoogleAuthProvider()
      );

      const ref = firestoreWrapper.doc(this.fs, `usuarios/${user.uid}`);

      await firestoreWrapper.setDoc(
        ref,
        {
          nombre: user.displayName ?? '',
          displayName: user.displayName ?? '',
          email: user.email ?? '',
          photoURL: user.photoURL ?? '',
          lastLogin: serverTimestamp(),
        },
        { merge: true }
      );

    } catch (e: any) {
      const code = e?.code as string | undefined;

      if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
        return;
      }

      throw e;
    } finally {
      this.loginEnCurso = false;
    }
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
      }),
      catchError(err => {
        console.error('[AuthService.getUsuarioPublico$] Firestore:', err);
        return of(null);
      })
    );
  }
}
