import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { filter, switchMap, take } from 'rxjs/operators';

import { HogarService } from './core/hogar/hogar.service';
import { AuthService } from './core/auth/auth.service';
import { DialogCrearHogarComponent } from './core/hogar/dialog-crear-hogar';
import { DialogInvitarPersona } from './core/invitaciones/dialog-invitar-persona';
import { DialogUnirseCodigo } from './core/invitaciones/dialog-unirse-codigo';
import { Auth } from '@angular/fire/auth';
import { Hogar } from './core/hogar/hogar.model';
import { ListaTareasComponent } from './core/tareas/lista-tareas.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    ListaTareasComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App {
  auth = inject(AuthService);
  hogarSvc = inject(HogarService);
  fbAuth = inject(Auth);
  dialog = inject(MatDialog);

  user$ = this.auth.user$;
  hogar$ = this.hogarSvc.getHogar$();

  onImageError(e: Event) {
    (e.target as HTMLImageElement).src = 'assets/default-avatar.png';
  }

  abrirInvitar(hogar: Hogar) {
    this.dialog.open(DialogInvitarPersona, {
      maxWidth: '480px',
      panelClass: 'crear-hogar-dialog',
      data: hogar.id,
      disableClose: true
    });
  }

  abrirUnirme() {
    this.dialog.open(DialogUnirseCodigo, {
      maxWidth: '400px',
      panelClass: 'crear-hogar-dialog',
      disableClose: true
    });
  }

  abrirCrearHogar() {
    const ref = this.dialog.open(DialogCrearHogarComponent, {
      disableClose: true,
      maxWidth: '480px',
      panelClass: 'crear-hogar-dialog',
    });

    ref.afterClosed()
      .pipe(take(1))
      .subscribe(nombre => {
        if (nombre) {
          const user = this.fbAuth.currentUser;
          if (user) {
            this.hogarSvc.crearHogar(nombre, user);
          }
        }
      });
  }
}
