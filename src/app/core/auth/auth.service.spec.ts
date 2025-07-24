
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { firebaseAuthWrapper } from './firebase-auth-wrapper';
import { firestoreWrapper } from './firestore-wrapper';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    });

    service = TestBed.inject(AuthService);
  });

  it('loginGoogle > debería iniciar sesión con Google y guardar usuario en Firestore', async () => {
    const mockUser = {
      uid: 'uid1',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: 'http://example.com/photo.png'
    };

    const signInSpy = spyOn(firebaseAuthWrapper, 'signInWithPopup').and.resolveTo({ user: mockUser } as any);
    const setDocSpy = spyOn(firestoreWrapper, 'setDoc').and.resolveTo();
    const docSpy = spyOn(firestoreWrapper, 'doc').and.returnValue({} as any);

    await service.loginGoogle();

    expect(signInSpy).toHaveBeenCalled();
    expect(docSpy).toHaveBeenCalledWith(jasmine.anything(), `usuarios/${mockUser.uid}`);
    expect(setDocSpy).toHaveBeenCalledWith(
      jasmine.anything(),
      jasmine.objectContaining({
        email: mockUser.email,
        displayName: mockUser.displayName,
        photoURL: mockUser.photoURL,
      }),
      { merge: true }
    );
  });

  it('logout > debería cerrar la sesión', async () => {
    const signOutSpy = spyOn(firebaseAuthWrapper, 'signOut').and.resolveTo();

    await service.logout();

    expect(signOutSpy).toHaveBeenCalled();
  });
});
