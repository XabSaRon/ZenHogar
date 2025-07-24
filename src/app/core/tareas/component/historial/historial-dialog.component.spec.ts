import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HistorialDialogComponent } from './historial-dialog.component';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

describe('HistorialDialogComponent', () => {
  let component: HistorialDialogComponent;
  let fixture: ComponentFixture<HistorialDialogComponent>;

  const mockData = {
    asignadoAnterior: {
      nombre: 'Lucía',
      foto: 'fake-url/lucia.png'
    },
    realizada: true,
    fecha: new Date('2024-05-01T12:00:00')
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistorialDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: mockData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HistorialDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debería tener acceso a los datos del historial', () => {
    expect(component.data.asignadoAnterior.nombre).toBe('Lucía');
    expect(component.data.realizada).toBeTrue();
    expect(component.data.fecha).toEqual(new Date('2024-05-01T12:00:00'));
  });

  it('debería cambiar la imagen al error de carga', () => {
    const imgElement = document.createElement('img');
    imgElement.src = 'original.png';

    const event = { target: imgElement } as unknown as Event;
    component.onImageError(event);

    expect(imgElement.src).toContain('assets/default-avatar.png');
  });
});
