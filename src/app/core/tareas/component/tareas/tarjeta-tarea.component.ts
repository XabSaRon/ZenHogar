import { Component, EventEmitter, Input, Output, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, query, where, collectionData } from '@angular/fire/firestore';
import { Observable, of, firstValueFrom } from 'rxjs';
import { switchMap, map, shareReplay, startWith, catchError } from 'rxjs/operators';

import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { Overlay } from '@angular/cdk/overlay';

import { Auth, authState } from '@angular/fire/auth';

import { TareasService } from '../../services/tareas.service';
import { TareaDTO } from '../../models/tarea.model';
import { HistorialDialogComponent } from '../historial/historial-dialog.component';
import { DialogValorarTarea } from '../valoraciones/dialog-valorar-tarea';
import { PENALIZACION_ABANDONO } from '../../utilidades/tareas.constants';
import { PeticionAsignacionDTO } from '../../models/peticion-asignacion.model';
import { DialogPeticionAsignacionComponent } from './peticiones/dialog-peticion-asignacion.component';
import { DialogCrearTareaComponent } from './crear-tarea/dialog-crear-tarea.component';
import { ConfirmDialogComponent } from '../../../../shared/dialog-confirm/dialog-confirm.component';

@Component({
  selector: 'app-tarjeta-tarea',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  templateUrl: './tarjeta-tarea.component.html',
  styleUrls: ['./tarjeta-tarea.component.scss'],
})
export class TarjetaTareaComponent implements OnChanges {
  @Input() tarea!: TareaDTO;
  @Input() uidActual = '';
  @Input() miembros: { uid: string; nombre: string; fotoURL?: string }[] = [];
  @Input() delay = 0;
  @Input() penalizacionAbandono = PENALIZACION_ABANDONO;
  @Input() destinatarioNombre?: string;
  @Input() adminUid: string | null = null;

  @Output() asignadoCambio = new EventEmitter<string>();
  @Output() penalizarAbandono = new EventEmitter<{ tareaId: string; uid: string; puntos: number }>();
  @Output() tareaCompletada = new EventEmitter<void>();

  private auth = inject(Auth);
  private lastTareaId: string | null = null;

  peticionesPendientes$!: Observable<PeticionAsignacionDTO[]>;
  hayPeticionPendiente$!: Observable<boolean>;
  peticionParaMi$!: Observable<boolean>;
  destinatarioNombre$!: Observable<string>;
  tooltipCampana$!: Observable<string>;

  ultimaPersonaHistorial: {
    uid: string;
    nombre: string;
    fotoURL?: string;
    fecha: any;
    completada: boolean;
  } | null = null;

  infoAbierta = false;

  constructor(
    private fs: Firestore,
    private dialog: MatDialog,
    private overlay: Overlay,
    private tareasService: TareasService,
    private snack: MatSnackBar
  ) { }

  ngOnChanges(): void {
    if (this.tarea?.historial?.length) {
      this.ultimaPersonaHistorial = this.tarea.historial[this.tarea.historial.length - 1];
    } else {
      this.ultimaPersonaHistorial = null;
    }

    const id = this.tarea?.id ?? null;
    if (id !== this.lastTareaId) {
      this.lastTareaId = id;
      this.crearStreamsPeticiones();
    }
  }

  private abriendoDialog = false;

  private crearStreamsPeticiones(): void {
    if (!this.tarea?.id) {
      this.peticionesPendientes$ = of([]);
      this.hayPeticionPendiente$ = of(false);
      this.peticionParaMi$ = of(false);
      this.destinatarioNombre$ = of('usuario');
      this.tooltipCampana$ = of('');
      return;
    }

    const base$ = authState(this.auth).pipe(
      startWith(null),
      switchMap(user => {
        if (!user) return of([] as PeticionAsignacionDTO[]);

        const col = collection(this.fs, 'peticionesAsignacion');
        const q = query(
          col,
          where('hogarId', '==', this.tarea.hogarId),
          where('tareaId', '==', this.tarea.id),
          where('estado', '==', 'pendiente')
        );
        return collectionData(q, { idField: 'id' }) as Observable<PeticionAsignacionDTO[]>;
      }),
      catchError(err => {
        console.error('🔥 peticionesPendientes$ error', this.tarea?.id, err);
        return of([] as PeticionAsignacionDTO[]);
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.peticionesPendientes$ = base$;

    this.hayPeticionPendiente$ = base$.pipe(
      map(pets => (pets?.length ?? 0) > 0),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.peticionParaMi$ = authState(this.auth).pipe(
      startWith(null),
      switchMap(user => {
        if (!user) return of(false);
        return base$.pipe(
          map(pets => pets?.some(p => p.paraUid === user.uid) ?? false)
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.destinatarioNombre$ = base$.pipe(
      map(pets => {
        if (!pets || pets.length === 0) return 'usuario';
        const mia = pets.find(p => p.paraUid === this.uidActual);
        const targetUid = mia ? this.uidActual : pets[0].paraUid;
        return this.miembros.find(m => m.uid === targetUid)?.nombre || 'usuario';
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.tooltipCampana$ = base$.pipe(
      map(pets => {
        const esMia = pets?.some(p => p.paraUid === this.uidActual) ?? false;
        if (esMia) return 'Tienes una petición de asignación';
        if (!pets || pets.length === 0) return '';
        const targetUid = pets[0].paraUid;
        const nombre = this.miembros.find(m => m.uid === targetUid)?.nombre || 'usuario';
        return `Pendiente de aceptación por ${nombre}`;
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  onImageError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-avatar.png';
  }

  toggleInfo(ev?: Event) {
    ev?.stopPropagation();
    this.infoAbierta = !this.infoAbierta;
  }

  get emoji(): string {
    const nombre = this.tarea.nombre.toLowerCase();
    if (nombre.includes('barrer')) return '🧹';
    if (nombre.includes('fregar')) return '🧼';
    if (nombre.includes('cocinar') || nombre.includes('comida')) return '🍳';
    if (nombre.includes('ropa') || nombre.includes('lavar')) return '👕';
    if (nombre.includes('baño') || nombre.includes('wc')) return '🚽';
    if (nombre.includes('sacar basura') || nombre.includes('basura')) return '🗑️';
    if (nombre.includes('limpiar')) return '🧽';
    if (nombre.includes('hacer la cama')) return '🛏️';
    if (nombre.includes('compra') || nombre.includes('supermercado')) return '🛒';
    if (nombre.includes('regar') || nombre.includes('plantas')) return '🌱';
    return '🏠';
  }

  get tieneValoracionPendiente(): boolean {
    return !!this.tarea?.bloqueadaHastaValoracion
      || ((this.tarea?.valoracionesPendientes?.length ?? 0) > 0);
  }

  get isEnCurso(): boolean {
    return !!this.tarea?.asignadA
      && !this.tarea?.completada
      && !this.tieneValoracionPendiente;
  }

  get puedeGestionarAsignacion(): boolean {
    if (this.tarea?.bloqueadaHastaValoracion) return false;
    if (this.isEnCurso) return this.tarea.asignadA === this.uidActual;
    return true;
  }

  get puedeAbrirMenu(): boolean {
    if (this.tarea?.bloqueadaHastaValoracion) return false;
    if (this.isEnCurso && this.tarea.asignadA !== this.uidActual) return false;
    return true;
  }

  get tooltipAsignacion(): string {
    if (this.tarea?.bloqueadaHastaValoracion) return 'Bloqueada hasta valorar';
    if (this.isEnCurso && this.tarea.asignadA !== this.uidActual) {
      return 'Solo puede reasignarla quien la tiene en curso';
    }
    return 'Asignar tarea';
  }

  get styleDelay(): { [key: string]: string } {
    const ms = this.delay * 80;
    return { animationDelay: `${ms}ms` };
  }

  get tienePuntosSinValoraciones(): boolean {
    const tieneValoraciones = (this.tarea.valoraciones?.length ?? 0) > 0;
    if (tieneValoraciones) return false;
    const ultima: any = this.tarea.historial?.[this.tarea.historial.length - 1];
    return typeof ultima?.puntosOtorgados === 'number';
  }

  private getTamanyoDialogoHistorial(): { width: string; height: string } {
    const BASE = { width: '450px', height: '345px' };
    const INTER = { width: '485px', height: '380px' };
    const GRANDE = { width: '520px', height: '417px' };

    const historial = this.tarea.historial ?? [];
    if (historial.length === 0) return BASE;

    const ultimo = historial[historial.length - 1];
    const fechaUltimo = this.parseSafeDate(ultimo?.fecha);

    const valoracionesCiclo = (this.tarea.valoraciones ?? []).filter(v => {
      const fv = this.parseSafeDate(v?.fecha);
      return !!fv && !!fechaUltimo && fv >= fechaUltimo;
    });

    const hayValoraciones = valoracionesCiclo.length > 0;

    const hayPuntosEnUltimo =
      typeof ultimo?.puntosOtorgados === 'number' ||
      !!ultimo?.fechaOtorgados;

    if (hayValoraciones) return GRANDE;
    if (hayPuntosEnUltimo) return INTER;
    return BASE;
  }

  private parseSafeDate(value: any): Date | null {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  async asignarAMiembro(uid: string) {
    if (!this.puedeGestionarAsignacion) return;

    const esLiberacion = uid === '';
    const soyElAsignado = this.tarea?.asignadA === this.uidActual;

    if (esLiberacion && this.isEnCurso && soyElAsignado) {
      const abs = Math.abs(this.penalizacionAbandono);

      const ref = this.dialog.open(ConfirmDialogComponent, {
        width: '460px',
        maxWidth: '92vw',
        panelClass: 'dialog-confirm',
        disableClose: true,
        autoFocus: true,
        restoreFocus: true,
        data: {
          title: 'Abandonar tarea',
          message: `Si te quitas esta tarea, quedará sin asignar y perderás ${abs} puntos.`,
          confirmLabel: `Sí, abandonar (-${abs})`,
          cancelLabel: 'Cancelar',
          icon: 'warning_amber',
          emphasis: this.tarea?.nombre || '',
          emphasisLabel: 'Vas a abandonar',
          tone: 'warn',
        }
      });

      const ok = await firstValueFrom(ref.afterClosed());
      if (!ok) return;

      this.snack.dismiss();
      this.snack.open(`⚠️ Tarea abandonada (-${abs} pts)`, 'OK', {
        duration: 2300,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });

      this.asignadoCambio.emit('');
      return;
    }

    this.asignadoCambio.emit(uid);
  }

  verHistorial() {
    if (!this.tarea.historial?.length) return;

    const ultima = this.tarea.historial[this.tarea.historial.length - 1];
    const { width, height } = this.getTamanyoDialogoHistorial();

    this.dialog.open(HistorialDialogComponent, {
      data: ultima,
      width,
      height,
      panelClass: 'dialog-historial',
      scrollStrategy: this.overlay.scrollStrategies.block(),
      autoFocus: true,
      restoreFocus: true
    });
  }

  marcarComoRealizada() {
    this.tareaCompletada.emit();
  }

  abrirDialogoValoracion() {
    this.dialog.open(DialogValorarTarea, {
      data: {
        tareaId: this.tarea.id,
        nombreTarea: this.tarea.nombre
      },
      width: '600px',
      panelClass: 'dialog-valorar',
      autoFocus: true,
      restoreFocus: true
    });
  }

  get estaAsignada(): boolean {
    return !!this.tarea?.asignadA;
  }

  get esPersonalizada(): boolean {
    return this.tarea?.personalizada === true;
  }

  get esAdmin(): boolean {
    return !!this.adminUid && this.uidActual === this.adminUid;
  }

  get esCreador(): boolean {
    return !!this.tarea?.creadorUid && this.uidActual === this.tarea.creadorUid;
  }

  get puedeGestionarTarea(): boolean {
    return this.esAdmin || this.esCreador;
  }

  get puedeEditar(): boolean {
    if (!this.esPersonalizada) return false;
    if (!this.puedeGestionarTarea) return false;
    if (this.estaAsignada) return false;
    if (this.tieneValoracionPendiente) return false;
    if (this.tarea?.completada) return false;
    return true;
  }

  get tooltipEditar(): string {
    if (!this.esPersonalizada) return 'Solo se pueden editar tareas personalizadas';
    if (this.estaAsignada) return 'No se puede editar mientras está asignada';
    if (this.tieneValoracionPendiente) return 'No se puede editar mientras esté pendiente de valoración';
    if (this.tarea?.completada) return 'No se puede editar una tarea completada';
    return 'Editar tarea';
  }

  get dificultadValue(): 1 | 2 | 3 {
    const p = Number(this.tarea.peso ?? 1);
    if (p <= 1) return 1;
    if (p === 2) return 2;
    return 3;
  }

  get dificultadLabel(): string {
    return this.dificultadValue === 1 ? 'Fácil' : this.dificultadValue === 2 ? 'Media' : 'Difícil';
  }

  get dificultadEmoji(): string {
    return this.dificultadValue === 1 ? '🟢' : this.dificultadValue === 2 ? '🟠' : '🔴';
  }

  get dificultadClass(): string {
    return this.dificultadValue === 1 ? 'dif-easy' : this.dificultadValue === 2 ? 'dif-med' : 'dif-hard';
  }

  get estadoLabel(): string {
    if (this.tieneValoracionPendiente) return 'Pendiente de valorar';
    if (this.isEnCurso) return 'En curso';
    if (this.tarea.asignadA) return 'Asignada';
    return 'Sin asignar';
  }

  get estadoClass(): string {
    if (this.tieneValoracionPendiente) return 'st-pending';
    if (this.isEnCurso) return 'st-progress';
    if (this.tarea.asignadA) return 'st-assigned';
    return 'st-free';
  }

  get estadoIcon(): string {
    if (this.tieneValoracionPendiente) return 'star_rate';
    if (this.isEnCurso) return 'hourglass_top';
    if (this.tarea.asignadA) return 'person';
    return 'lock_open';
  }

  get descEsLarga(): boolean {
    const d = (this.tarea.descripcion ?? '').trim();
    return d.length >= 70;
  }

  get valoracionesFinales(): number[] {
    return (this.tarea.historial ?? [])
      .map(h => Number(h?.puntuacionFinal))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 5);
  }

  get mediaEstrellas(): number | null {
    const vals = this.valoracionesFinales;
    if (!vals.length) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return Math.round((sum / vals.length) * 10) / 10;
  }

  get numValoraciones(): number {
    return this.valoracionesFinales.length;
  }

  get estrellasPintadas(): number {
    return Math.round((this.mediaEstrellas ?? 0));
  }

  async editarTarea(ev: MouseEvent) {
    ev.stopPropagation();
    if (!this.puedeEditar) return;
    if (!this.tarea?.id) return;

    const ref = this.dialog.open(DialogCrearTareaComponent, {
      width: '520px',
      panelClass: 'crear-tarea-dialog',
      data: {
        modo: 'editar',
        tarea: {
          nombre: this.tarea.nombre,
          descripcion: this.tarea.descripcion ?? '',
          peso: this.tarea.peso ?? 1,
        },
      },
    });

    const res = await firstValueFrom(ref.afterClosed());
    if (!res) return;

    try {
      this.snack.dismiss();

      await this.tareasService.actualizarTarea(this.tarea.id, {
        nombre: res.nombre,
        descripcion: res.descripcion,
        peso: res.peso,
      });

      this.snack.open('✅ Tarea actualizada', 'OK', {
        duration: 2200,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
    } catch (e) {
      console.error(e);

      this.snack.dismiss();
      this.snack.open('❌ No se pudo actualizar la tarea', 'OK', {
        duration: 2800,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
    }
  }

  async onClickCampana(ev: MouseEvent) {
    ev.stopPropagation();
    if (this.abriendoDialog) return;
    this.abriendoDialog = true;

    const user = await firstValueFrom(authState(this.auth));
    if (!user) { this.abriendoDialog = false; return; }

    const lista = await firstValueFrom(this.peticionesPendientes$);
    const paraMi = lista.find(p => p.paraUid === user.uid);
    if (!paraMi) { this.abriendoDialog = false; return; }

    const ref = this.dialog.open(DialogPeticionAsignacionComponent, {
      width: '480px',
      maxWidth: '92vw',
      maxHeight: '72dvh',
      panelClass: 'dialog-peticion-asignacion',
      data: { peticion: paraMi, tareaNombre: this.tarea?.nombre || 'Tarea' },
      scrollStrategy: this.overlay.scrollStrategies.block(),
      disableClose: true
    });

    ref.afterClosed().subscribe(() => this.abriendoDialog = false);
  }
}
