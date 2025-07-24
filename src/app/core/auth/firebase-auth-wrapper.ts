import {
  Auth,
  GoogleAuthProvider,
  signInWithPopup as signInWithPopupFirebase,
  signOut as signOutFirebase,
  UserCredential,
} from '@angular/fire/auth';

export const firebaseAuthWrapper = {
  signInWithPopup: (
    auth: Auth,
    provider: GoogleAuthProvider
  ): Promise<UserCredential> => signInWithPopupFirebase(auth, provider),

  signOut: (auth: Auth): Promise<void> => signOutFirebase(auth),
};

