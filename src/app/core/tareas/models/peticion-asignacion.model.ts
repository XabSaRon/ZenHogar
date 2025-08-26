export interface PeticionAsignacionDTO {
  id?: string;
  tareaId: string;
  hogarId: string;

  deUid: string;
  deNombre?: string;

  paraUid: string;
  paraNombre?: string;

  estado: 'pendiente' | 'aceptada' | 'rechazada';
  fecha: string;

  // --- RECHAZOS ---
  rechazadaEn?: any;
  rechazadaPorUid?: string;
  rechazadaPorNombre?: string | null;
  rechazoNotificadoSolicitante?: boolean;
  rechazoNotificadoSolicitanteEn?: any;

  // --- ACEPTADAS ---
  aceptadaEn?: any;
  aceptadaPorUid?: string;
  aceptadaPorNombre?: string | null;
  aceptacionNotificadaSolicitante?: boolean;
  aceptacionNotificadaSolicitanteEn?: any;
}


