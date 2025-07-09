import { serverTimestamp } from '@angular/fire/firestore';
import { Tarea } from '../tarea.model';

export const TAREAS_POR_DEFECTO: Omit<Tarea, 'id'>[] = [
  {
    nombre: 'Barrer/Aspirar',
    descripcion: 'Limpiar el suelo con escoba o aspiradora en todas las habitaciones.',
    completada: false,
    asignadA: '',
    hogarId: ''
  },
  {
    nombre: 'Fregar',
    descripcion: 'Fregar el suelo con agua y producto de limpieza.',
    completada: false,
    asignadA: '',
    hogarId: ''
  },
  {
    nombre: 'Cocinar comida',
    descripcion: 'Preparar la comida principal del día para todos los miembros.',
    completada: false,
    asignadA: '',
    hogarId: ''
  },
  {
    nombre: 'Lavar la ropa',
    descripcion: 'Poner la lavadora con la ropa acumulada y tender si es necesario.',
    completada: false,
    asignadA: '',
    hogarId: ''
  },
  {
    nombre: 'Limpiar baño',
    descripcion: 'Limpiar inodoro, lavabo, espejo y suelo del baño.',
    completada: false,
    asignadA: '',
    hogarId: ''
  },
  {
    nombre: 'Sacar basura',
    descripcion: 'Recoger la basura y llevarla al contenedor correspondiente.',
    completada: false,
    asignadA: '',
    hogarId: ''
  },
  {
    nombre: 'Limpiar polvo',
    descripcion: 'Pasar un paño o trapo para eliminar el polvo de muebles y superficies.',
    completada: false,
    asignadA: '',
    hogarId: ''
  },
  {
    nombre: 'Hacer la cama',
    descripcion: 'Estirar las sábanas, colocar cojines y dejar la cama ordenada.',
    completada: false,
    asignadA: '',
    hogarId: ''
  }
];

