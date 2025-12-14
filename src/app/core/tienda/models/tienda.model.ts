export type TipoRecompensa = 'predefinida' | 'personalizada';

export interface Recompensa {
  id: string;
  titulo: string;
  descripcion: string;
  coste: number;
  icono: string;
  tipo: TipoRecompensa;
  soloZenPrime?: boolean;
  badge?: 'popular' | 'top'
}

export interface DialogTiendaData {
  puntosDisponibles: number;
  esZenPrime: boolean;
  usuarioUid?: string;
  hogarId?: string;
  esAdmin?: boolean;
  esDemo?: boolean;
  recompensasPersonalizadas?: Recompensa[];
}
