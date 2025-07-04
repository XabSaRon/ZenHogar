import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
} from '@angular/fire/firestore';
import { Observable, defer, switchMap } from 'rxjs';
import { Tarea } from './tarea.model';
import { HogarService } from './hogar.service';

@Injectable({ providedIn: 'root' })
export class TareasService {
  private fs = inject(Firestore);
  private hogarSvc = inject(HogarService);
  private tareasRef: ReturnType<typeof collection> | null = null;

  private async ensureRef() {
    if (!this.tareasRef) {
      const hogarId = await this.hogarSvc.getOrCreateHogar();
      this.tareasRef = collection(this.fs, `hogares/${hogarId}/tareas`);
    }
  }

  obtenerTareas(): Observable<Tarea[]> {
    return defer(() => this.ensureRef()).pipe(
      switchMap(() =>
        collectionData(this.tareasRef!, { idField: 'id' }) as Observable<Tarea[]>
      )
    );
  }

  async agregarTarea(t: Omit<Tarea, 'id'>) {
    await this.ensureRef();
    return addDoc(this.tareasRef!, { ...t, creadaEn: new Date() });
  }
}



