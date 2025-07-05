import { Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { InvitacionesService } from './invitaciones.service';
import { EmailService } from './inivitaciones/email.service';
import { HogarService } from './hogar.service';

@Component({
  standalone: true,
  selector: 'app-dialog-invitar-persona',
  templateUrl: './dialog-invitar-persona.html',
  styleUrls: ['./dialog-invitar-persona.scss'],
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
  ],
})
export class DialogInvitarPersona {
  email = '';

  private ref = inject(MatDialogRef<DialogInvitarPersona>);
  private invit = inject(InvitacionesService);
  private emailSvc = inject(EmailService);
  private snack = inject(MatSnackBar);
  private hogarSvc = inject(HogarService);


  hogarId: string = inject(MAT_DIALOG_DATA);

  async enviar(f: NgForm) {
    if (f.invalid) return;

    try {
      const codigo = await this.invit.crearInvitacion(
        this.hogarId,
        this.email.trim()
      );

      const hogar = await firstValueFrom(this.hogarSvc.getHogar$());
      const nombreHogar = hogar?.nombre || 'ZenHogar';

      await this.emailSvc.enviarInvitacion(
        this.email.trim(),
        nombreHogar,
        codigo
      );

      this.snack.open('Invitación enviada ✔️', 'Cerrar', { duration: 4000 });
      this.ref.close(this.email.trim());
    } catch (err) {
      console.error(err);
      this.snack.open('Error al enviar invitación 😕', 'Cerrar', { duration: 5000 });
    }
  }
}
