export interface PeticionAsignacionDTO {
  id?: string;
  tareaId: string;
  hogarId: string;
  deUid: string;
  paraUid: string;
  estado: 'pendiente' | 'aceptada' | 'rechazada';
  fecha: string;
}
