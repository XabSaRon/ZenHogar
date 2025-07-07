import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { filter, switchMap, take } from 'rxjs/operators';

import { TarjetaTareaComponent } from './core/tareas/tarjeta-tarea.component';
import { TareasService } from './core/tareas/tareas.service';
import { HogarService } from './core/hogar/hogar.service';
import { AuthService } from './core/auth/auth.service';
import { DialogCrearHogarComponent } from './core/hogar/dialog-crear-hogar';
import { DialogInvitarPersona } from './core/invitaciones/dialog-invitar-persona';
import { Auth } from '@angular/fire/auth';
import { Hogar } from './core/hogar/hogar.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    TarjetaTareaComponent,
    AsyncPipe,
    NgIf,
    NgFor,
    FormsModule,
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App implements OnInit {
  title = 'zenhogar';

  // Servicios
  auth = inject(AuthService);
  hogarSvc = inject(HogarService);
  tareasSvc = inject(TareasService);
  fbAuth = inject(Auth);
  dialog = inject(MatDialog);

  // Streams
  user$ = this.auth.user$;
  hogar$ = this.hogarSvc.getHogar$();
  tareas$ = this.hogar$.pipe(
    filter((h): h is any => !!h),
    switchMap(() => this.tareasSvc.obtenerTareas())
  );

  onImageError(ev: Event) {
    (ev.target as HTMLImageElement).src = 'assets/default-avatar.png';
  }

  private dialogRef?: MatDialogRef<DialogCrearHogarComponent>;

  ngOnInit() {
    this.user$
      .pipe(
        filter(Boolean),
        switchMap(() => this.hogar$),
        take(1)
      )
      .subscribe(hogar => {
        if (hogar === null) {
          this.dialogRef = this.dialog.open(DialogCrearHogarComponent, {
            disableClose: true,
            width: 'auto',
            maxWidth: '480px',
            panelClass: 'crear-hogar-dialog'
          });

          this.dialogRef.afterClosed()
            .pipe(take(1))
            .subscribe(nombre => {
              this.dialogRef = undefined;
              if (nombre) {
                const user = this.fbAuth.currentUser;
                if (user) this.hogarSvc.crearHogar(nombre, user);
              }
            });
        }
      });
  }

  abrirInvitar(hogar: Hogar) {
    const ref = this.dialog.open(DialogInvitarPersona, {
      width: 'auto',
      maxWidth: '480px',
      panelClass: 'crear-hogar-dialog',
      data: hogar.id,
      disableClose: true
    });

    ref.afterClosed()
      .pipe(take(1))
      .subscribe(email => {
        if (email) {
          console.log('Invitar a', email, 'al hogar', hogar.id);
        }
      });
  }
}

