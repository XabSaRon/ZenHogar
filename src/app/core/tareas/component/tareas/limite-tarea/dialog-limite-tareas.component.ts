import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-dialog-limite-tareas',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './dialog-limite-tareas.component.html',
  styleUrls: ['./dialog-limite-tareas.component.scss']
})
export class DialogLimiteTareasComponent {
  constructor(
    private ref: MatDialogRef<DialogLimiteTareasComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { max: number; actuales?: number }
  ) { }
  cerrar() { this.ref.close(); }
}
