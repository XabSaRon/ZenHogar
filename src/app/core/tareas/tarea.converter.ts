import {
  FirestoreDataConverter,
  DocumentData,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from '@angular/fire/firestore';
import { Tarea } from './tarea.model';

export const tareaConverter: FirestoreDataConverter<Tarea> = {
  toFirestore(t: Tarea): DocumentData {
    return { ...t };
  },
  fromFirestore(
    snap: QueryDocumentSnapshot,
    options: SnapshotOptions
  ): Tarea {
    return {
      id: snap.id,
      ...(snap.data(options) as Omit<Tarea, 'id'>),
    };
  },
};
