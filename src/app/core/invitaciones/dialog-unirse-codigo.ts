import { Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule, NgIf } from '@angular/common';

import { InvitacionesService } from './invitaciones.service';

@Component({
  standalone: true,
  selector: 'app-dialog-unirse-codigo',
  templateUrl: './dialog-unirse-codigo.html',
  styleUrls: ['./dialog-unirse-codigo.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
})
export class DialogUnirseCodigo {
  codigo = '';
  loading = false;

  private ref = inject(MatDialogRef<DialogUnirseCodigo>);
  private invit = inject(InvitacionesService);
  private snack = inject(MatSnackBar);

  async unir(f: NgForm) {
    if (f.invalid || this.loading) return;
    this.loading = true;

    try {
      await this.invit.aceptarCodigo(this.codigo.trim());
      this.snack.open('¡Te has unido al hogar! 🎉', 'Cerrar', { duration: 4000 });
      this.ref.close(true);
    } catch (err: any) {
      this.snack.open(err.message || 'Código inválido 😕', 'Cerrar', { duration: 5000 });
    } finally {
      this.loading = false;
    }
  }

  cancelar() {
    if (!this.loading) this.ref.close();
  }
}
