import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { filter, switchMap, take } from 'rxjs/operators';

import { HogarService } from './core/hogar/services/hogar.service';
import { AuthService } from './core/auth/auth.service';
import { DialogCrearHogarComponent } from './core/hogar/component/dialog-crear-hogar';
import { DialogInvitarPersona } from './core/invitaciones/component/invitar/dialog-invitar-persona';
import { DialogUnirseCodigo } from './core/invitaciones/component/unirse/dialog-unirse-codigo';
import { Auth } from '@angular/fire/auth';
import { Hogar } from './core/hogar/models/hogar.model';
import { ListaTareasComponent } from './core/tareas/component/tareas/lista-tareas.component';

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
  usuarioCompleto$ = this.auth.usuarioCompleto$;
  hogar$ = this.hogarSvc.getHogar$();

  onImageError(e: Event) {
    (e.target as HTMLImageElement).src = 'assets/default-avatar.png';
  }

  abrirInvitar(hogar: Hogar) {
    this.dialog.open(DialogInvitarPersona, {
      width: '500px',
      maxWidth: '92vw',
      panelClass: 'invitar-dialog',
      data: hogar.id,
      disableClose: true
    });
  }

  abrirUnirme() {
    this.dialog.open(DialogUnirseCodigo, {
      width: '500px',
      maxWidth: '92vw',
      panelClass: 'unirse-dialog',
      disableClose: true
    });
  }

  abrirCrearHogar() {
    const ref = this.dialog.open(DialogCrearHogarComponent, {
      disableClose: true,
      width: '540px',
      maxWidth: '92vw',
      maxHeight: '72dvh',
      panelClass: 'crear-hogar-dialog',
    });

    ref.afterClosed()
      .pipe(take(1))
      .subscribe((result?: { nombre: string; provincia: string }) => {
        if (!result) return;

        const { nombre, provincia } = result;
        if (!nombre?.trim() || !provincia) return;

        const user = this.fbAuth.currentUser;
        if (!user) return;

        this.hogarSvc.crearHogar(nombre.trim(), provincia, user)
          .catch(err => {
            console.error('Error creando hogar:', err);
          });
      });
  }

}
