import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Overlay } from '@angular/cdk/overlay';

import { TareaDTO } from '../../models/tarea.model';
import { HistorialDialogComponent } from '../historial/historial-dialog.component';
import { DialogValorarTarea } from '../valoraciones/dialog-valorar-tarea';
import { PENALIZACION_ABANDONO } from '../../utilidades/tareas.constants';

@Component({
  selector: 'app-tarjeta-tarea',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule
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

  @Output() asignadoCambio = new EventEmitter<string>();
  @Output() penalizarAbandono = new EventEmitter<{ tareaId: string; uid: string; puntos: number }>();
  @Output() tareaCompletada = new EventEmitter<void>();

  ultimaPersonaHistorial: {
    uid: string;
    nombre: string;
    fotoURL?: string;
    fecha: any;
    completada: boolean;
  } | null = null;

  constructor(private dialog: MatDialog, private overlay: Overlay) { }

  ngOnChanges(): void {
    if (this.tarea?.historial?.length) {
      this.ultimaPersonaHistorial = this.tarea.historial[this.tarea.historial.length - 1];
    } else {
      this.ultimaPersonaHistorial = null;
    }
  }

  onImageError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-avatar.png';
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
    const tieneValoraciones = (this.tarea.valoraciones?.length ?? 0) > 0;
    if (tieneValoraciones) return { width: '520px', height: '417px' };
    if (this.tienePuntosSinValoraciones) return { width: '485px', height: '380px' };
    return { width: '450px', height: '345px' };
  }

  asignarAMiembro(uid: string) {
    if (!this.puedeGestionarAsignacion) return;

    const esLiberacion = uid === '';
    const soyElAsignado = this.tarea?.asignadA === this.uidActual;

    if (esLiberacion && this.isEnCurso && soyElAsignado) {
      this.penalizarAbandono.emit({
        tareaId: this.tarea.id!,
        uid: this.uidActual,
        puntos: this.penalizacionAbandono,
      });
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
      scrollStrategy: this.overlay.scrollStrategies.noop()
    });
  }

  marcarComoRealizada() {
    this.tareaCompletada.emit();
  }

  abrirDialogoValoracion() {
    this.dialog.open(DialogValorarTarea, {
      data: { tareaId: this.tarea.id },
      width: '500px',
      panelClass: 'dialog-valorar'
    });
  }
}
