import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-dialog-crear-hogar',
  standalone: true,
  templateUrl: './dialog-crear-hogar.html',
  styleUrls: ['./dialog-crear-hogar.scss'],
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
})
export class DialogCrearHogarComponent {
  nombre = '';
  private ref = inject(MatDialogRef<DialogCrearHogarComponent>);

  crear(): void {
    const limpio = this.nombre.trim();
    if (limpio) {
      this.ref.close(limpio);
    }
  }

  cancelar(): void {
    this.ref.close(null);
  }
}
