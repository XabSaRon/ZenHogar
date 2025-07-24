import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';

import { InvitacionesService } from '../../services/invitaciones.service';

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

  constructor(
    private ref: MatDialogRef<DialogUnirseCodigo>,
    private invit: InvitacionesService,
    private snack: MatSnackBar
  ) { }

  async unir(f: NgForm) {
    if (f.invalid || this.loading) return;
    this.loading = true;

    try {
      await this.invit.aceptarCodigo(this.codigo.trim());
      this.snack.open('¡Te has unido al hogar! 🎉', 'Cerrar', { duration: 4000 });
      f.resetForm();
      this.ref.close(true);
    } catch (err: any) {
      this.snack.open(this.getFriendlyError(err), 'Cerrar', { duration: 5000 });
      f.controls['codigo']?.reset();
    } finally {
      this.loading = false;
    }
  }

  cancelar() {
    if (!this.loading) this.ref.close();
  }

  private getFriendlyError(err: any): string {
    const msg = (err?.message ?? '').toLowerCase();

    if (msg.includes('no corresponde con tu email')) {
      return 'El código no está asociado a tu correo 😕';
    }
    if (msg.includes('hogar no encontrado')) {
      return 'El hogar ya no existe 🙈';
    }
    if (msg.includes('ya usado')) {
      return 'Este código ya se utilizó';
    }
    if (msg.includes('debes iniciar sesión')) {
      return 'Inicia sesión antes de unirte';
    }
    return 'No se pudo usar el código 😕';
  }
}
