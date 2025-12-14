export interface Canjeo {
  id: string;
  recompensaId: string;
  titulo: string;
  puntosGastados: number;
  fecha: Date;
  tipo: 'predefinida' | 'personalizada';
}
