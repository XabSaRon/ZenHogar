import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogUnirseCodigo } from './dialog-unirse-codigo';
import { MatDialogRef } from '@angular/material/dialog';
import { InvitacionesService } from '../../services/invitaciones.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgForm } from '@angular/forms';

describe('DialogUnirseCodigo', () => {
  let component: DialogUnirseCodigo;
  let fixture: ComponentFixture<DialogUnirseCodigo>;

  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<DialogUnirseCodigo>>;
  let invitacionesServiceSpy: jasmine.SpyObj<InvitacionesService>;
  let snackBarSpy: jasmine.SpyObj<MatSnackBar>;

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);
    invitacionesServiceSpy = jasmine.createSpyObj('InvitacionesService', ['aceptarCodigo']);
    snackBarSpy = jasmine.createSpyObj('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [DialogUnirseCodigo],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: InvitacionesService, useValue: invitacionesServiceSpy },
        { provide: MatSnackBar, useValue: snackBarSpy },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DialogUnirseCodigo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debería unirse correctamente si el formulario es válido', async () => {
    component.codigo = 'ABC123';
    const mockForm = {
      invalid: false,
      resetForm: jasmine.createSpy('resetForm'),
      controls: {
        codigo: { reset: jasmine.createSpy('reset') }
      }
    } as any as NgForm;

    invitacionesServiceSpy.aceptarCodigo.and.resolveTo(undefined);

    await component.unir(mockForm);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(invitacionesServiceSpy.aceptarCodigo).toHaveBeenCalledWith('ABC123');
    expect(snackBarSpy.open).toHaveBeenCalledWith('¡Te has unido al hogar! 🎉', 'Cerrar', { duration: 4000 });
    expect(mockForm.resetForm).toHaveBeenCalled();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });

  it('no debería unirse si el formulario es inválido', async () => {
    const mockForm = { invalid: true } as NgForm;
    await component.unir(mockForm);
    expect(invitacionesServiceSpy.aceptarCodigo).not.toHaveBeenCalled();
  });

  it('debería manejar errores conocidos y mostrar mensaje amigable', async () => {
    component.codigo = 'ABC123';
    const mockForm = {
      invalid: false,
      resetForm: jasmine.createSpy('resetForm'),
      controls: {
        codigo: { reset: jasmine.createSpy('reset') }
      }
    } as any as NgForm;

    const error = new Error('Este código ya fue usado');
    invitacionesServiceSpy.aceptarCodigo.and.rejectWith(error);

    await component.unir(mockForm);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(snackBarSpy.open).toHaveBeenCalledWith('Este código ya se utilizó', 'Cerrar', { duration: 5000 });
    expect(mockForm.controls['codigo'].reset).toHaveBeenCalled();
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });

  it('debería cerrar el diálogo al cancelar si no está cargando', () => {
    component.loading = false;
    component.cancelar();
    expect(dialogRefSpy.close).toHaveBeenCalled();
  });

  it('no debería cerrar el diálogo al cancelar si está cargando', () => {
    component.loading = true;
    component.cancelar();
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });
});
