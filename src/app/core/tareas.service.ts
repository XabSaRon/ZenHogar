import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, addDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Tarea } from './tarea.model';

@Injectable({
  providedIn: 'root',
})
export class TareasService {
  private tareasRef;

  constructor(private firestore: Firestore) {
    this.tareasRef = collection(this.firestore, 'tareas');
  }

  obtenerTareas(): Observable<Tarea[]> {
    return collectionData(this.tareasRef, { idField: 'id' }) as Observable<Tarea[]>;
  }

  agregarTarea(tarea: Tarea) {
    return addDoc(this.tareasRef, tarea);
  }
}

