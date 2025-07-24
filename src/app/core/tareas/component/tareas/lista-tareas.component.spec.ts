import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListaTareasComponent } from './lista-tareas.component';
import { AuthService } from '../../../auth/auth.service';
import { HogarService } from '../../../hogar/services/hogar.service';
import { TareasService } from '../../services/tareas.service';
import { of } from 'rxjs';
import { Firestore } from '@angular/fire/firestore';
import { TareaDTO } from '../../models/tarea.model';
import { User } from '@angular/fire/auth';


describe('ListaTareasComponent', () => {
  let component: ListaTareasComponent;
  let fixture: ComponentFixture<ListaTareasComponent>;

  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let hogarServiceSpy: jasmine.SpyObj<HogarService>;
  let tareasServiceSpy: jasmine.SpyObj<TareasService>;
  let firestoreSpy: jasmine.SpyObj<Firestore>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      user$: of({ uid: '123', displayName: 'Xabi' })
    });

    hogarServiceSpy = jasmine.createSpyObj('HogarService', ['getHogar$']);
    tareasServiceSpy = jasmine.createSpyObj('TareasService', ['getTareasPorHogar', 'asignarTarea']);
    firestoreSpy = jasmine.createSpyObj('Firestore', ['dummy']);

    hogarServiceSpy.getHogar$.and.returnValue(of(null));

    await TestBed.configureTestingModule({
      imports: [ListaTareasComponent],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: HogarService, useValue: hogarServiceSpy },
        { provide: TareasService, useValue: tareasServiceSpy },
        { provide: Firestore, useValue: firestoreSpy }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ListaTareasComponent);
    component = fixture.componentInstance;
  });

  it('debería crearse correctamente', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('debería cargar tareas si hay hogar', (done) => {
    const mockUser = {
      uid: '123',
      displayName: 'Xabi',
      emailVerified: true,
      isAnonymous: false,
      metadata: {} as any,
      providerData: [],
      refreshToken: '',
      tenantId: null,
      delete: () => Promise.resolve(),
      getIdToken: () => Promise.resolve('token'),
      getIdTokenResult: () => Promise.resolve({} as any),
      reload: () => Promise.resolve(),
      toJSON: () => ({}),
      photoURL: null,
      providerId: 'firebase'
    } as unknown as User;

    const mockHogar = {
      id: 'hogar123',
      nombre: 'Mi Hogar',
      ownerUid: 'uid123',
      miembros: [],
      createdAt: {} as any
    };
    const mockTareas: TareaDTO[] = [
      { id: 't1', nombre: 'Fregar platos', hogarId: 'hogar123', completada: false, asignadoNombre: '' }
    ];

    authServiceSpy.user$ = of(mockUser);
    hogarServiceSpy.getHogar$.and.returnValue(of(mockHogar));
    tareasServiceSpy.getTareasPorHogar.and.returnValue(of(mockTareas));

    fixture = TestBed.createComponent(ListaTareasComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();

    component.tareas$.subscribe((tareas) => {
      expect(tareas).toEqual(mockTareas);
      expect(tareasServiceSpy.getTareasPorHogar).toHaveBeenCalledWith('hogar123');
      done();
    });
  });


  it('no debería cargar tareas si no hay hogar', (done) => {
    hogarServiceSpy.getHogar$.and.returnValue(of(null));
    fixture.detectChanges();

    component.tareas$.subscribe((tareas) => {
      expect(tareas).toEqual([]);
      done();
    });
  });

  it('debería llamar a asignarTarea en reasignarTarea()', async () => {
    tareasServiceSpy.asignarTarea.and.resolveTo();
    await component.reasignarTarea('tarea1', 'usuario123');
    expect(tareasServiceSpy.asignarTarea).toHaveBeenCalledWith('tarea1', 'usuario123');
  });

  it('no debería llamar a asignarTarea si tareaId es undefined', async () => {
    await component.reasignarTarea(undefined, 'usuario123');
    expect(tareasServiceSpy.asignarTarea).not.toHaveBeenCalled();
  });
});
