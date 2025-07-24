import {
  Firestore,
  doc as docFirestore,
  setDoc as setDocFirestore,
  SetOptions,
} from '@angular/fire/firestore';

export const firestoreWrapper = {
  doc: (fs: Firestore, path: string) => docFirestore(fs, path),
  setDoc: (ref: any, data: any, options: SetOptions) =>
    setDocFirestore(ref, data, options),
};
