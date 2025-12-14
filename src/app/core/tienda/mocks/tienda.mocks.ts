import { Recompensa } from '../models/tienda.model';

export const RECOMPENSAS_PREDEFINIDAS_MOCK: Recompensa[] = [
  {
    id: 'libre-tarea',
    titulo: 'Librarse de una tarea',
    descripcion: 'No haces una tarea esta semana 🎉',
    coste: 100,
    icono: 'weekend',
    tipo: 'predefinida',
    badge: 'top'
  },
  {
    id: 'elige-pelicula',
    titulo: 'Elegir la película',
    descripcion: 'Tú eliges la peli de la noche de cine.',
    coste: 40,
    icono: 'movie',
    tipo: 'predefinida',
    badge: 'popular'
  },
  {
    id: 'desayuno-cama',
    titulo: 'Desayuno en la cama',
    descripcion: 'Alguien te prepara un desayuno épico.',
    coste: 80,
    icono: 'coffee',
    tipo: 'predefinida'
  },

  {
    id: 'elige-musica',
    titulo: 'DJ por un día',
    descripcion: 'Tú pones la música durante 24h 🎧',
    coste: 60,
    icono: 'headphones',
    tipo: 'predefinida'
  }
];

