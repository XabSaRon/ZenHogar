import { Timestamp, FieldValue } from '@angular/fire/firestore';

export interface Tarea {
  id?: string;
  nombre: string;
  descripcion?: string;
  completada: boolean;
  asignadA?: string | null;
  hogarId: string;
  createdAt?: Timestamp | FieldValue;
  asignadoNombre?: string | null;
  asignadoFotoURL?: string | null;
  peso?: number;
  personalizada?: boolean;

  historial?: {
    uid: string;
    nombre: string;
    fotoURL?: string;
    fecha: string;
    completada: boolean;

    puntosOtorgados?: number;
    pesoUsado?: number;
    puntuacionFinal?: number;
    fechaOtorgados?: string;
    hogarId?: string;
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
  asignadoFotoURL?: string | null;
}
