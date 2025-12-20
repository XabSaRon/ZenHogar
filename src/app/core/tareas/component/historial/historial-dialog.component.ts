import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { DatePipe, CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

interface UltimaAsignacionData {
  uid: string;
  nombre: string;
  fotoURL?: string;
  fecha: string;
  completada: boolean;

  puntuacionFinal?: number;
  puntosOtorgados?: number;
  pesoUsado?: number;
  fechaOtorgados?: string;
}

@Component({
  selector: 'app-historial-dialog',
  standalone: true,
  templateUrl: './historial-dialog.component.html',
  styleUrls: ['./historial-dialog.component.scss'],
  imports: [
    CommonModule,
    MatDialogModule,
    DatePipe,
    MatIconModule
  ]
})
export class HistorialDialogComponent {
  readonly stars = [1, 2, 3, 4, 5];

  constructor(
    private dialogRef: MatDialogRef<HistorialDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: UltimaAsignacionData
  ) { }

  get tieneSnapshot(): boolean {
    return typeof this.data?.puntuacionFinal === 'number'
      || typeof this.data?.puntosOtorgados === 'number'
      || typeof this.data?.pesoUsado === 'number';
  }

  get dificultadLabel(): string {
    switch (this.data.pesoUsado) {
      case 1: return 'Fácil';
      case 2: return 'Media';
      case 3: return 'Difícil';
      default: return 'Desconocido';
    }
  }

  get dificultadClase(): string {
    switch (this.data.pesoUsado) {
      case 1: return 'dificultad-facil';
      case 2: return 'dificultad-media';
      case 3: return 'dificultad-dificil';
      default: return '';
    }
  }

  onImageError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-avatar.png';
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}


