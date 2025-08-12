import { TareaDTO } from '../models/tarea.model';

export const DEMO_MIEMBROS = [
  { uid: 'u1', nombre: 'Laura', fotoURL: 'https://randomuser.me/api/portraits/women/44.jpg' },
  { uid: 'u2', nombre: 'Carlos', fotoURL: 'https://randomuser.me/api/portraits/men/45.jpg' },
  { uid: 'u3', nombre: 'Marta', fotoURL: 'https://randomuser.me/api/portraits/women/46.jpg' },
];

export function generarTareasDemo(): TareaDTO[] {
  const base: Array<Partial<TareaDTO>> = [
    { id: 'd1', nombre: 'Fregar platos', descripcion: 'Después de comer', peso: 1 },
    { id: 'd2', nombre: 'Sacar basura', descripcion: 'A las 20:00', peso: 1 },
    { id: 'd3', nombre: 'Barrer salón', descripcion: '', peso: 2 },
    { id: 'd4', nombre: 'Limpieza baño', descripcion: '', peso: 3 },
    { id: 'd5', nombre: 'Poner lavadora', descripcion: '', peso: 2 },
    { id: 'd6', nombre: 'Tender ropa', descripcion: '', peso: 1 },
    { id: 'd7', nombre: 'Aspirar pasillo', descripcion: '', peso: 2 },
    { id: 'd8', nombre: 'Limpiar cocina', descripcion: '', peso: 3 },
    { id: 'd9', nombre: 'Regar plantas', descripcion: '', peso: 1 },
    { id: 'd10', nombre: 'Hacer la compra', descripcion: '', peso: 2 },
  ];

  return base.map((t, i) => {
    const tarea: TareaDTO = {
      id: t.id ?? `demo-${i + 1}`,
      nombre: t.nombre ?? `Tarea ${i + 1}`,
      descripcion: t.descripcion ?? '',
      peso: t.peso ?? 1,
      hogarId: 'DEMO',
      asignadA: null,
      asignadoNombre: '',
      asignadoFotoURL: '',
      completada: false,
      historial: [],
      valoraciones: [],
      valoracionesPendientes: [],
      bloqueadaHastaValoracion: false,
    };

    if (i === 0) {
      tarea.historial = [
        {
          uid: 'u1',
          nombre: 'Laura',
          fotoURL: DEMO_MIEMBROS[0].fotoURL,
          fecha: new Date(Date.now() - 86400000 * 3).toISOString(),
          completada: true,
          hogarId: 'DEMO',
          puntosOtorgados: 10,
          pesoUsado: tarea.peso,
          puntuacionFinal: 5,
          fechaOtorgados: new Date(Date.now() - 86400000 * 3 + 3600000).toISOString(),
        }
      ];
    }

    if (i === 1) {
      tarea.completada = true;
      tarea.historial = [
        {
          uid: 'u2',
          nombre: 'Carlos',
          fotoURL: DEMO_MIEMBROS[1].fotoURL,
          fecha: new Date(Date.now() - 86400000).toISOString(),
          completada: false,
          hogarId: 'DEMO',
          puntosOtorgados: -100,
          pesoUsado: tarea.peso,
          puntuacionFinal: 0,
          fechaOtorgados: new Date(Date.now() - 86400000 * 3 + 3600000).toISOString(),
        }
      ];
      tarea.valoracionesPendientes = ['u1', 'u3'];
      tarea.bloqueadaHastaValoracion = true;
    }

    if (i === 2) {
      tarea.historial = [
        {
          uid: 'u3',
          nombre: 'Marta',
          fotoURL: DEMO_MIEMBROS[2].fotoURL,
          fecha: new Date(Date.now() - 86400000 * 5).toISOString(),
          completada: true,
          hogarId: 'DEMO',
          puntosOtorgados: 5,
          pesoUsado: tarea.peso,
          puntuacionFinal: 4,
          fechaOtorgados: new Date(Date.now() - 86400000 * 5 + 7200000).toISOString(),
        }
      ];
    }

    if (i === 8) {
      tarea.completada = true;
      tarea.historial = [
        {
          uid: 'u1',
          nombre: 'Laura',
          fotoURL: DEMO_MIEMBROS[0].fotoURL,
          fecha: new Date(Date.now() - 86400000 * 2).toISOString(),
          completada: true,
          hogarId: 'DEMO',
          puntosOtorgados: 2,
          pesoUsado: tarea.peso,
          puntuacionFinal: 1,
          fechaOtorgados: new Date(Date.now() - 86400000 * 3 + 3600000).toISOString(),
        }
      ];
      tarea.valoracionesPendientes = ['u2', 'u3'];
      tarea.bloqueadaHastaValoracion = true;
    }

    return tarea;
  });
}

