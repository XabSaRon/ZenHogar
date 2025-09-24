import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogInvitarPersona } from './dialog-invitar-persona';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { InvitacionesService } from '../../services/invitaciones.service';
import { EmailService } from '../../../../shared/email/email.service';
import { HogarService } from '../../../hogar/services/hogar.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgForm } from '@angular/forms';
import { of } from 'rxjs';
import { fakeAsync, tick } from '@angular/core/testing';

describe('DialogInvitarPersona', () => {
  let component: DialogInvitarPersona;
  let fixture: ComponentFixture<DialogInvitarPersona>;

  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<DialogInvitarPersona>>;
  let invitacionesServiceSpy: jasmine.SpyObj<InvitacionesService>;
  let emailServiceSpy: jasmine.SpyObj<EmailService>;
  let hogarServiceSpy: jasmine.SpyObj<HogarService>;
  let snackBarSpy: jasmine.SpyObj<MatSnackBar>;

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);
    invitacionesServiceSpy = jasmine.createSpyObj('InvitacionesService', ['crearInvitacion']);
    emailServiceSpy = jasmine.createSpyObj('EmailService', ['enviarInvitacion']);
    hogarServiceSpy = jasmine.createSpyObj('HogarService', ['getHogar$']);
    snackBarSpy = jasmine.createSpyObj('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [DialogInvitarPersona],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: 'hogar-id-mock' },
        { provide: InvitacionesService, useValue: invitacionesServiceSpy },
        { provide: EmailService, useValue: emailServiceSpy },
        { provide: HogarService, useValue: hogarServiceSpy },
        { provide: MatSnackBar, useValue: snackBarSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DialogInvitarPersona);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debería enviar una invitación correctamente', fakeAsync(() => {
    component.email = 'test@example.com';
    const mockForm = { invalid: false } as NgForm;
    const mockCodigo = 'ABC123';
    const mockHogar = {
      nombre: 'Mi Hogar',
      ownerUid: 'uid123',
      miembros: [],
      createdAt: {} as any,
      countryCode: 'ES',
      provincia: 'Bizkaia',
      provinciaCode: 'BI'
    };

    invitacionesServiceSpy.crearInvitacion.and.resolveTo(mockCodigo);
    hogarServiceSpy.getHogar$.and.returnValue(of(mockHogar));
    emailServiceSpy.enviarInvitacion.and.resolveTo(undefined);

    component.enviar(mockForm);
    tick();

    expect(invitacionesServiceSpy.crearInvitacion).toHaveBeenCalledWith('hogar-id-mock', 'test@example.com');
    expect(emailServiceSpy.enviarInvitacion).toHaveBeenCalledWith('test@example.com', 'Mi Hogar', mockCodigo);
    expect(snackBarSpy.open).toHaveBeenCalledWith('Invitación enviada ✔️', 'Cerrar', { duration: 4000 });
    expect(dialogRefSpy.close).toHaveBeenCalledWith('test@example.com');
  }));

  it('no debería enviar si el formulario es inválido', async () => {
    const mockForm = { invalid: true } as NgForm;
    await component.enviar(mockForm);
    expect(invitacionesServiceSpy.crearInvitacion).not.toHaveBeenCalled();
  });

  it('debería cerrar el diálogo si se cancela y no está cargando', () => {
    component.loading = false;
    component.cancelar();
    expect(dialogRefSpy.close).toHaveBeenCalled();
  });

  it('no debería cerrar el diálogo si está cargando', () => {
    component.loading = true;
    component.cancelar();
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });

});
