import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TarjetaTareaComponent } from './tarjeta-tarea.component';
import { MatDialog } from '@angular/material/dialog';
import { TareaDTO } from '../../models/tarea.model';

describe('TarjetaTareaComponent', () => {
  let component: TarjetaTareaComponent;
  let fixture: ComponentFixture<TarjetaTareaComponent>;
  let dialogSpy: jasmine.SpyObj<MatDialog>;

  function mockTimestamp(): any {
    return {
      toDate: () => new Date(),
      toMillis: () => Date.now(),
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
      isEqual: () => true
    };
  }

  const tareaBase: TareaDTO = {
    id: 't1',
    nombre: 'Fregar el suelo',
    historial: [],
    asignadoNombre: '',
    completada: false,
    hogarId: 'hogar123'
  };

  beforeEach(async () => {
    dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      imports: [TarjetaTareaComponent],
      providers: [{ provide: MatDialog, useValue: dialogSpy }]
    }).compileComponents();

    fixture = TestBed.createComponent(TarjetaTareaComponent);
    component = fixture.componentInstance;

    component.tarea = { ...tareaBase };
    fixture.detectChanges();
  });

  it('debería crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debería devolver el emoji correcto según el nombre de la tarea', () => {
    component.tarea.nombre = 'Fregar platos';
    expect(component.emoji).toBe('🧼');

    component.tarea.nombre = 'Sacar basura';
    expect(component.emoji).toBe('🗑️');

    component.tarea.nombre = 'Lavar la ropa';
    expect(component.emoji).toBe('👕');

    component.tarea.nombre = 'Tarea desconocida';
    expect(component.emoji).toBe('🏠');
  });

  it('debería emitir el cambio de asignación', () => {
    spyOn(component.asignadoCambio, 'emit');
    component.asignarAMiembro('usuario123');
    expect(component.asignadoCambio.emit).toHaveBeenCalledWith('usuario123');
  });

  it('debería abrir el historial si existe historial', () => {
    component.tarea.historial = [
      {
        uid: 'u1',
        nombre: 'Lucía',
        fotoURL: 'lucia.jpg',
        fecha: mockTimestamp(),
        completada: true
      }
    ];

    component.verHistorial();
    expect(dialogSpy.open).toHaveBeenCalled();
  });

  it('no debería abrir el historial si no hay historial', () => {
    component.tarea.historial = [];
    component.verHistorial();
    expect(dialogSpy.open).not.toHaveBeenCalled();
  });

  it('debería cambiar la imagen al fallback en onImageError()', () => {
    const img = document.createElement('img');
    img.src = 'original.jpg';
    const event = { target: img } as unknown as Event;

    component.onImageError(event);
    expect(img.src).toContain('assets/default-avatar.png');
  });
});

