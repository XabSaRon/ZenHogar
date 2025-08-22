import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TareasService } from '../../../services/tareas.service';
import { PeticionAsignacionDTO } from '../../../models/peticion-asignacion.model';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  standalone: true,
  selector: 'app-dialog-peticion-asignacion',
  templateUrl: './dialog-peticion-asignacion.component.html',
  styleUrls: ['./dialog-peticion-asignacion.component.scss'],
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule]
})
export class DialogPeticionAsignacionComponent {
  peticion: PeticionAsignacionDTO;
  tareaNombre: string;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { peticion: PeticionAsignacionDTO; tareaNombre: string },
    private dialogRef: MatDialogRef<DialogPeticionAsignacionComponent>,
    private tareas: TareasService,
    private snack: MatSnackBar
  ) {
    this.peticion = data.peticion;
    this.tareaNombre = data.tareaNombre;
  }

  async aceptar() {
    try {
      await this.tareas.aceptarPeticion(this.peticion.id!);
      this.snack.open('✅ Petición aceptada. Tarea asignada a ti.', 'Cerrar', { duration: 2500 });
      this.dialogRef.close(true);
    } catch (e) {
      console.error(e);
      this.snack.open('❌ No se pudo aceptar la petición', 'Cerrar', { duration: 3000 });
    }
  }

  async rechazar() {
    try {
      await this.tareas.rechazarPeticion(this.peticion.id!);
      this.snack.open('👌 Petición rechazada.', 'Cerrar', { duration: 2000 });
      this.dialogRef.close(false);
    } catch (e) {
      console.error(e);
      this.snack.open('❌ No se pudo rechazar la petición', 'Cerrar', { duration: 3000 });
    }
  }
}
