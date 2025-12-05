import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';

import { TareasService } from '../../services/tareas.service';
import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-dialog-valorar-tarea',
  standalone: true,
  templateUrl: './dialog-valorar-tarea.html',
  styleUrls: ['./dialog-valorar-tarea.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
  ],
})
export class DialogValorarTarea {
  valorSeleccionado = 0;
  comentario = '';

  estrellas = [
    { valor: 1, etiqueta: 'Muy mal' },
    { valor: 2, etiqueta: 'Mal' },
    { valor: 3, etiqueta: 'Normal' },
    { valor: 4, etiqueta: 'Bien' },
    { valor: 5, etiqueta: 'Excelente' },
  ];

  constructor(
    private dialogRef: MatDialogRef<DialogValorarTarea>,
    @Inject(MAT_DIALOG_DATA) public data: { tareaId: string; nombreTarea?: string },
    private tareasService: TareasService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) { }

  get isDemoMode(): boolean {
    return !this.authService.uidActual;
  }

  seleccionarEstrella(valor: number) {
    this.valorSeleccionado = valor;
  }

  cerrarDialogo() {
    this.dialogRef.close();
  }

  guardarValoracion() {
    if (this.valorSeleccionado === 0) return;

    const uid = this.authService.uidActual;
    if (!uid) {
      this.snackBar.open('👀 Demo: aquí se guardaría tu valoración.', 'Cerrar', { duration: 3000 });
      this.dialogRef.close({ ok: true, demo: true });
      return;
    }

    this.tareasService
      .valorarTarea(this.data.tareaId, this.valorSeleccionado, this.comentario.trim(), uid)
      .then(() => this.dialogRef.close({ ok: true }))
      .catch((err) => {
        console.error('Error al guardar valoración:', err);
        this.snackBar.open('❌ Error al guardar la valoración', 'Cerrar', { duration: 3000 });
      });
  }
}
