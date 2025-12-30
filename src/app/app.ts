import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { take, combineLatest, map, Subscription, startWith, shareReplay } from 'rxjs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Auth, User } from '@angular/fire/auth';

import { HogarService } from './core/hogar/services/hogar.service';
import { AuthService } from './core/auth/auth.service';
import { DialogCrearHogarComponent } from './core/hogar/component/crear/dialog-crear-hogar';
import { DialogInvitarPersona } from './core/invitaciones/component/invitar/dialog-invitar-persona';
import { DialogUnirseCodigo } from './core/invitaciones/component/unirse/dialog-unirse-codigo';
import { Hogar, TipoHogar } from './core/hogar/models/hogar.model';
import { ListaTareasComponent } from './core/tareas/component/tareas/lista-tareas.component';

import { DialogTiendaComponent } from './core/tienda/dialog-tienda/dialog-tienda.component';
import { DialogTiendaData } from './core/tienda/models/tienda.model';
import { TiendaService } from './core/tienda/services/tienda.service';
import { NotificacionesService } from './core/hogar/notificaciones/services/notificaciones.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatSnackBarModule,
    ListaTareasComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App implements OnInit, OnDestroy {
  auth = inject(AuthService);
  hogarSvc = inject(HogarService);
  fbAuth = inject(Auth);
  dialog = inject(MatDialog);
  tiendaSvc = inject(TiendaService);
  notificacionesSvc = inject(NotificacionesService);
  snackBar = inject(MatSnackBar);

  ultimoCanjeoOk = false;
  mostrarConfetti = false;
  confettiPieces = Array.from({ length: 18 }).map((_, i) => i);
  puntosAnimados = 0;
  private subs = new Subscription();

  user$ = this.auth.user$;
  usuarioCompleto$ = this.auth.usuarioCompleto$;
  hogar$ = this.hogarSvc.getHogarState$();
  isAdmin$ = combineLatest([this.user$, this.hogar$]).pipe(
    map(([u, h]) => !!u && !!h && (u.uid === h.ownerUid))
  );
  userState$ = this.user$.pipe(
    startWith(undefined as unknown as User | null | undefined),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  hogarActual: Hogar | null = null;

  ngOnInit(): void {
    const sub = this.usuarioCompleto$.subscribe({
      next: usuario => {
        const nuevos = usuario?.puntos ?? 0;
        this.puntosAnimados = nuevos;
      },
      error: err => console.error('[App.usuarioCompleto$]', err),
    });

    const subHogar = this.hogar$.subscribe({
      next: hogar => {
        this.hogarActual = hogar ?? null;
      },
      error: err => console.error('[App.hogar$]', err),
    })

    this.subs.add(sub);
    this.subs.add(subHogar);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  onImageError(e: Event) {
    (e.target as HTMLImageElement).src = 'assets/default-avatar.png';
  }

  abrirInvitar(hogar: Hogar) {
    this.dialog.open(DialogInvitarPersona, {
      width: '800px',
      maxWidth: '92vw',
      panelClass: 'invitar-dialog',
      data: hogar.id,
      disableClose: true
    });
  }

  abrirUnirme() {
    if (this.hogarActual) return;
    this.dialog.open(DialogUnirseCodigo, {
      width: '500px',
      maxWidth: '92vw',
      panelClass: 'unirse-dialog',
      disableClose: true
    });
  }

  abrirCrearHogar() {
    if (this.hogarActual) return;
    const ref = this.dialog.open(DialogCrearHogarComponent, {
      disableClose: true,
      width: '560px',
      maxWidth: '92vw',
      maxHeight: '72dvh',
      panelClass: 'crear-hogar-dialog',
    });

    ref.afterClosed()
      .pipe(take(1))
      .subscribe((result?: {
        nombre: string;
        provincia: string;
        provinciaCode?: string;
        countryCode?: string;
        tipoHogar?: TipoHogar;
      }) => {
        if (!result) return;

        const { nombre, provincia, provinciaCode, countryCode, tipoHogar } = result;
        if (!nombre?.trim() || !provincia || !tipoHogar) return;

        const user = this.fbAuth.currentUser;
        if (!user) return;

        this.hogarSvc
          .crearHogar(
            nombre.trim(),
            provincia,
            user,
            provinciaCode,
            countryCode ?? 'ES',
            tipoHogar
          )
          .catch(err => console.error('Error creando hogar:', err));
      });
  }

  abrirTienda(usuario: { puntos?: number } | null, hogar: Hogar | null) {
    if (!usuario || !hogar) return;

    const fbUser = this.fbAuth.currentUser;
    const usuarioUid = fbUser?.uid;
    const hogarId = hogar.id;
    const esAdmin = hogar.ownerUid === usuarioUid;

    if (!usuarioUid || !hogarId) {
      console.error('[Tienda] Faltan ids para abrir la tienda', { usuarioUid, hogarId });
      return;
    }

    this.tiendaSvc.getRecompensasPersonalizadas(hogarId)
      .pipe(take(1))
      .subscribe(personalizadas => {
        const ref = this.dialog.open(DialogTiendaComponent, {
          maxWidth: '1320px',
          panelClass: 'tienda-dialog',
          autoFocus: false,
          data: <DialogTiendaData>{
            puntosDisponibles: usuario.puntos ?? 0,
            esZenPrime: false,
            esDemo: false,
            usuarioUid,
            hogarId,
            esAdmin,
            recompensasPersonalizadas: personalizadas
          }
        });

        ref.afterClosed()
          .pipe(take(1))
          .subscribe(result => {
            if (!result || result.accion !== 'canjear') return;

            const { recompensa, puntosGastados } = result;

            this.tiendaSvc
              .canjearRecompensa(usuarioUid, puntosGastados, recompensa)
              .then(async () => {
                try {
                  await this.notificacionesSvc.crearNotificacionCanje(hogarId, {
                    actorUid: usuarioUid,
                    actorNombre: fbUser?.displayName ?? 'alguien',
                    recompensaId: recompensa.id,
                    recompensaTitulo: recompensa.titulo,
                    coste: puntosGastados,
                  });
                } catch (e) {
                  console.error('Error creando notificación de canje:', e);
                }

                this.snackBar.open(
                  `Has canjeado "${recompensa.titulo}" (-${puntosGastados} pts) 🎉`,
                  'Genial',
                  { duration: 4000 }
                );
                this.dispararAnimacionPuntos();
              })
              .catch(err => console.error('Error canjeando recompensa:', err));
          });
      });
  }

  abrirTiendaDemo() {
    if (this.fbAuth.currentUser) return;
    this.dialog.open(DialogTiendaComponent, {
      maxWidth: '1120px',
      panelClass: 'tienda-dialog',
      autoFocus: false,
      data: <DialogTiendaData>{
        puntosDisponibles: 120,
        esZenPrime: true,
        esDemo: true,
        esAdmin: true,
        usuarioUid: 'demo'
      }
    });
  }

  private dispararAnimacionPuntos() {
    queueMicrotask(() => {
      this.ultimoCanjeoOk = false;
      this.mostrarConfetti = false;

      setTimeout(() => {
        this.ultimoCanjeoOk = true;
        this.mostrarConfetti = true;

        setTimeout(() => {
          this.ultimoCanjeoOk = false;
          this.mostrarConfetti = false;
        }, 1900);
      }, 0);
    });
  }

}
