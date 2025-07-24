import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';

import { TareaDTO } from '../../models/tarea.model';
import { HistorialDialogComponent } from '../historial/historial-dialog.component';

@Component({
  selector: 'app-tarjeta-tarea',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatMenuModule,
  ],
  templateUrl: './tarjeta-tarea.component.html',
  styleUrls: ['./tarjeta-tarea.component.scss'],
})
export class TarjetaTareaComponent {
  @Input() tarea!: TareaDTO;
  @Input() uidActual = '';
  @Input() miembros: { uid: string; nombre: string; fotoURL?: string }[] = [];

  @Output() asignadoCambio = new EventEmitter<string>();

  constructor(private dialog: MatDialog) { }

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
    return '🏠';
  }

  asignarAMiembro(uid: string) {
    this.asignadoCambio.emit(uid);
  }

  verHistorial() {
    if (!this.tarea.historial?.length) return;

    const ultima = this.tarea.historial[this.tarea.historial.length - 1];
    this.dialog.open(HistorialDialogComponent, {
      data: ultima,
      width: '500px',
      height: '314px',
      panelClass: 'dialog-historial'
    });
  }
}
