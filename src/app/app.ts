import { Component, inject, OnInit } from '@angular/core';
import { TarjetaTareaComponent } from './shared/tarjeta-tarea/tarjeta-tarea.component';
import { TareasService } from './core/tareas.service';
import { HogarService } from './core/hogar.service';
import { AuthService } from './core/auth.service';
import { AsyncPipe, NgIf, NgFor, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth } from '@angular/fire/auth';
import { MatDialog, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { DialogCrearHogarComponent } from './core/dialog-crear-hogar';
import { filter, switchMap, take } from 'rxjs/operators';
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
    FormsModule
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App implements OnInit {
  title = 'zenhogar';

  auth = inject(AuthService);
  hogarSvc = inject(HogarService);
  tareasSvc = inject(TareasService);
  fbAuth = inject(Auth);
  dialog = inject(MatDialog);

  user$ = this.auth.user$;

  hogar$ = this.hogarSvc.getHogar$();

  tareas$ = this.hogar$.pipe(
    filter((h): h is any => !!h),
    switchMap(() => this.tareasSvc.obtenerTareas())
  );

  onImageError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-avatar.png';
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
          const ref = this.dialog.open(DialogCrearHogarComponent, {
            disableClose: true,
            width: 'auto',
            maxWidth: '480px',
            panelClass: 'crear-hogar-dialog'
          });

          ref.afterClosed()
            .pipe(take(1))
            .subscribe(nombre => {
              if (nombre) {
                const user = this.fbAuth.currentUser;
                if (user) this.hogarSvc.crearHogar(nombre, user);
              }
            });
        }
      });
  }
}
