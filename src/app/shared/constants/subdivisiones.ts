import {
  PROVINCIAS_INE,
  ENTIDADES_MX_INEGI,
  PROVINCIAS_AR,
  DEPARTAMENTOS_BO,
  REGIONES_CL,
  DEPARTAMENTOS_CO,
  PROVINCIAS_CR,
  PROVINCIAS_CU,
  PROVINCIAS_DO,
  PROVINCIAS_EC,
  DEPARTAMENTOS_GT,
  DEPARTAMENTOS_HN,
  DEPARTAMENTOS_NI,
  PROVINCIAS_PA,
  DEPARTAMENTOS_PE,
  DEPARTAMENTOS_PY,
  DEPARTAMENTOS_SV,
  DEPARTAMENTOS_UY,
  ESTADOS_VE,
} from './provincias';

export type Subdivisiones = { code: string; name: string };

export const SUBDIVISIONS = {
  ES: PROVINCIAS_INE,
  AR: PROVINCIAS_AR,
  BO: DEPARTAMENTOS_BO,
  CL: REGIONES_CL,
  CO: DEPARTAMENTOS_CO,
  CR: PROVINCIAS_CR,
  CU: PROVINCIAS_CU,
  DO: PROVINCIAS_DO,
  EC: PROVINCIAS_EC,
  GT: DEPARTAMENTOS_GT,
  HN: DEPARTAMENTOS_HN,
  MX: ENTIDADES_MX_INEGI,
  NI: DEPARTAMENTOS_NI,
  PA: PROVINCIAS_PA,
  PE: DEPARTAMENTOS_PE,
  PY: DEPARTAMENTOS_PY,
  SV: DEPARTAMENTOS_SV,
  UY: DEPARTAMENTOS_UY,
  VE: ESTADOS_VE,
} as const;

export type CountryCode = keyof typeof SUBDIVISIONS;

export const COUNTRY_NAMES: Record<CountryCode, string> = {
  ES: 'España', MX: 'México', AR: 'Argentina', BO: 'Bolivia', CL: 'Chile',
  CO: 'Colombia', CR: 'Costa Rica', CU: 'Cuba', DO: 'Rep. Dominicana',
  EC: 'Ecuador', GT: 'Guatemala', HN: 'Honduras', NI: 'Nicaragua',
  PA: 'Panamá', PE: 'Perú', PY: 'Paraguay', SV: 'El Salvador',
  UY: 'Uruguay', VE: 'Venezuela',
};

export const AVAILABLE_COUNTRIES = Object.keys(SUBDIVISIONS) as CountryCode[];

export function countryName(code: string | undefined | null): string {
  const c = (code ?? '').toUpperCase() as CountryCode;
  return (COUNTRY_NAMES as Record<string, string>)[c] ?? (c || '');
}

export function flagPath(code: string | undefined | null): string {
  return `assets/flags/${(code ?? '').toLowerCase()}.svg`;
}

