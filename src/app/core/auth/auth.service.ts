
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
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { firebaseAuthWrapper } from './firebase-auth-wrapper';
import { firestoreWrapper } from './firestore-wrapper';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private fs = inject(Firestore);

  user$: Observable<User | null> = authState(this.auth);
  public uidActual: string | null = null;

  constructor() {
    this.user$.subscribe(user => {
      this.uidActual = user?.uid ?? null;
    });
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
