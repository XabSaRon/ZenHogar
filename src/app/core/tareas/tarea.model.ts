import { Timestamp } from '@angular/fire/firestore';
export interface Tarea {
  id?: string;
  nombre: string;
  descripcion?: string;
  completada: boolean;
  asignadA?: string;
  hogarId: string;
  createdAt?: Timestamp;
}

export interface TareaDTO extends Tarea {
  asignadoNombre: string;
  asignadoFotoURL?: string;
}
