import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes), provideFirebaseApp(() => initializeApp({ projectId: "zenhogar", appId: "1:510560024719:web:4998c8b614297f092518fa", storageBucket: "zenhogar.firebasestorage.app", apiKey: "AIzaSyCN076QlS13sNsVn_JRO9JUFXNv_N05Cc4", authDomain: "zenhogar.firebaseapp.com", messagingSenderId: "510560024719" })), provideAuth(() => getAuth()), provideFirestore(() => getFirestore())
  ]
};
