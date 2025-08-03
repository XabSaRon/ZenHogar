import { Timestamp } from '@angular/fire/firestore';

export interface Tarea {
  id?: string;
  nombre: string;
  descripcion?: string;
  completada: boolean;
  asignadA?: string;
  hogarId: string;
  createdAt?: Timestamp;
  asignadoNombre?: string;
  asignadoFotoURL?: string;

  historial?: {
    uid: string;
    nombre: string;
    fotoURL?: string;
    fecha: string;
    completada: boolean;
  }[];

  valoraciones?: {
    uid: string;
    puntos: number;
    comentario?: string;
    fecha: string;
  }[];

  valoracionesPendientes?: string[];

  bloqueadaHastaValoracion?: boolean;
}

export interface TareaDTO extends Tarea {
  asignadoNombre: string;
  asignadoFotoURL?: string;
}

