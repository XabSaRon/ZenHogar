import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogCrearHogarComponent } from './dialog-crear-hogar';
import { MatDialogRef } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';

describe('DialogCrearHogarComponent', () => {
  let component: DialogCrearHogarComponent;
  let fixture: ComponentFixture<DialogCrearHogarComponent>;
  let mockDialogRef: jasmine.SpyObj<MatDialogRef<DialogCrearHogarComponent>>;

  beforeEach(async () => {
    mockDialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [DialogCrearHogarComponent],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DialogCrearHogarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debería cerrar el diálogo con el nombre limpio al llamar a crear()', () => {
    component.nombre = '  Mi Hogar  ';
    component.crear();
    expect(mockDialogRef.close).toHaveBeenCalledWith('Mi Hogar');
  });

  it('no debería cerrar el diálogo si el nombre está vacío o solo tiene espacios', () => {
    component.nombre = '   ';
    component.crear();
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('debería cerrar el diálogo con null al llamar a cancelar()', () => {
    component.cancelar();
    expect(mockDialogRef.close).toHaveBeenCalledWith(null);
  });
});
