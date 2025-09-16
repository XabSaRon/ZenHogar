import type { Timestamp } from 'firebase/firestore';

export type TipoHogar = 'Familiar' | 'Pareja' | 'Amigos' | 'Erasmus';

export interface Hogar {
  id?: string;
  nombre: string;
  countryCode: string;
  provincia: string;
  provinciaCode: string;
  ownerUid: string;
  miembros: string[];
  createdAt: Timestamp | null;
  tipoHogar?: TipoHogar;
}
