import { bootstrapApplication } from '@angular/platform-browser';
import { isDevMode } from '@angular/core';
import { appConfig } from './app/app.config';
import { App } from './app/app';

import { setLogLevel } from 'firebase/firestore';

/*
if (isDevMode()) {
  setLogLevel('debug'); // 'debug' | 'error' | 'silent'
}
  */

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
