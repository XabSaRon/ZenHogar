import { Injectable, inject } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  authState,
  User,
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  setDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private fs = inject(Firestore);

  /** Observable del usuario autenticado (null si no hay) */
  user$: Observable<User | null> = authState(this.auth);

  /** Inicia sesión con Google */
  async loginGoogle() {
    const { user } = await signInWithPopup(this.auth, new GoogleAuthProvider());

    // Crea o actualiza el documento de usuario en /usuarios/{uid}
    const ref = doc(this.fs, 'usuarios', user.uid);
    await setDoc(
      ref,
      {
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        photoURL: user.photoURL ?? '',
        lastLogin: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  /** Cierra sesión */
  logout() {
    return signOut(this.auth);
  }
}

