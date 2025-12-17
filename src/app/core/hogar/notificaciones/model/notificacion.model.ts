export type NotificacionTipo = 'canje' | 'aceptada' | 'rechazo';

export interface NotificacionDTO {
  id?: string;
  tipo: NotificacionTipo;
  hogarId: string;

  createdAt: any;

  actorUid: string;
  actorNombre: string;

  recompensaId?: string;
  recompensaTitulo?: string;
  coste?: number;

  vistoPor?: Record<string, true>;
}
