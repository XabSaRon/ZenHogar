import { Component, inject, Inject } from '@angular/core';
import { FormsModule, NgForm, FormGroupDirective } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { ErrorStateMatcher } from '@angular/material/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';

import { InvitacionesService } from '../../services/invitaciones.service';
import { EmailService } from '../../../../shared/email/email.service';
import { HogarService } from '../../../hogar/services/hogar.service';

class SubmitErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: any, form: FormGroupDirective | NgForm | null): boolean {
    return !!(control && control.invalid && form && form.submitted);
  }
}

type MiembroVM = {
  uid: string;
  nombre?: string | null;
  email?: string | null;
  fotoURL?: string | null;
  esAdmin: boolean;
  soyYo: boolean;
};

@Component({
  standalone: true,
  selector: 'app-dialog-invitar-persona',
  templateUrl: './dialog-invitar-persona.html',
  styleUrls: ['./dialog-invitar-persona.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
})
export class DialogInvitarPersona {
  email = '';
  loading = false;
  confirmando = false;
  matcher = new SubmitErrorStateMatcher();

  private ref = inject(MatDialogRef<DialogInvitarPersona>);
  private invit = inject(InvitacionesService);
  private emailSvc = inject(EmailService);
  private snack = inject(MatSnackBar);
  private hogarSvc = inject(HogarService);
  private auth = inject(Auth);
  private fs = inject(Firestore);
  private md = inject(MatDialog);

  hogarId: string = inject(MAT_DIALOG_DATA);

  private ownerUid: string | null = null;
  private miUid: string | null = null;

  esAdmin = false;
  miembros: MiembroVM[] = [];
  loadingTransfer: Record<string, boolean> = {};
  loadingEliminar = false;

  constructor() {
    this.miUid = this.auth.currentUser?.uid ?? null;

    this.hogarSvc.getHogar$()
      .pipe(take(1))
      .subscribe(async h => {
        if (!h) {
          this.esAdmin = false;
          this.miembros = [];
          return;
        }

        this.ownerUid = h.ownerUid ?? null;
        this.esAdmin = !!this.miUid && !!this.ownerUid && this.miUid === this.ownerUid;

        this.miembros = await this.cargarMiembrosConPerfil(h);
      });
  }

  private async cargarMiembrosConPerfil(h: any): Promise<MiembroVM[]> {
    if (!h) return [];

    const owner = (h?.ownerUid || h?.adminUid) ?? null;
    const miUid = this.miUid;

    const uids: string[] = (Array.isArray(h?.miembros) ? h.miembros : [])
      .map((m: any) => (typeof m === 'string' ? m : (m?.uid)))
      .filter((x: any) => !!x);

    const perfiles = await Promise.all(uids.map(async (uid) => {
      try {
        const snap = await getDoc(doc(this.fs, `usuarios/${uid}`));
        const u = snap.exists() ? (snap.data() as any) : null;
        return {
          uid,
          nombre: u?.displayName ?? u?.nombre ?? null,
          email: u?.email ?? null,
          fotoURL: u?.photoURL ?? u?.fotoURL ?? null,
          esAdmin: !!owner && uid === owner,
          soyYo: !!miUid && uid === miUid,
        } as MiembroVM;
      } catch {
        return {
          uid,
          nombre: null,
          email: null,
          fotoURL: null,
          esAdmin: !!owner && uid === owner,
          soyYo: !!miUid && uid === miUid,
        } as MiembroVM;
      }
    }));

    perfiles.sort((a, b) => Number(b.esAdmin) - Number(a.esAdmin));
    return perfiles;
  }

  async enviar(f: NgForm) {
    if (f.invalid || this.loading) return;
    this.loading = true;
    try {
      const codigo = await this.invit.crearInvitacion(this.hogarId, this.email.trim());
      const hogar = await firstValueFrom(this.hogarSvc.getHogar$());
      const nombreHogar = hogar?.nombre || 'ZenHogar';

      await this.emailSvc.enviarInvitacion(this.email.trim(), nombreHogar, codigo);
      this.snack.open('Invitación enviada ✔️', 'Cerrar', { duration: 4000 });
      this.ref.close(this.email.trim());
    } catch (err) {
      console.error(err);
      this.snack.open('Error al enviar invitación 😕', 'Cerrar', { duration: 5000 });
    } finally {
      this.loading = false;
    }
  }

  cancelar() {
    if (!this.loading) this.ref.close();
  }

  confirmarSalida() {
    this.confirmando = true;
  }

  async salir() {
    if (this.loading) return;
    this.loading = true;
    try {
      await this.hogarSvc.salirDeHogar(this.hogarId);
      this.snack.open('Has salido del hogar', 'Cerrar', { duration: 3500 });
      this.ref.close({ salio: true });
    } catch (err: any) {
      console.error(err);
      const msg = err?.message === 'ADMIN_MUST_TRANSFER'
        ? 'Eres administrador: transfiere la administración o disuelve el hogar.'
        : 'No se pudo completar la salida';
      this.snack.open(msg, 'Cerrar', { duration: 4500 });
      this.confirmando = false;
    } finally {
      this.loading = false;
    }
  }

  onImageError(ev: Event) {
    (ev.target as HTMLImageElement).src = 'assets/default-avatar.png';
  }

  async transferirAdmin(m: MiembroVM) {
    if (this.loading || this.loadingTransfer[m.uid]) return;
    if (!this.esAdmin) return;

    const result = await firstValueFrom(
      this.md.open(ConfirmTransferDialog, {
        data: { uid: m.uid, nombre: m.nombre, email: m.email },
        disableClose: true,
        autoFocus: false,
        restoreFocus: true
      }).afterClosed()
    );

    if (result !== true) {
      return;
    }

    this.loadingTransfer[m.uid] = true;
    try {
      await this.hogarSvc.transferirAdmin(this.hogarId, m.uid);
      this.snack.open('Administración transferida ✅', 'Cerrar', { duration: 3000 });

      this.ownerUid = m.uid;
      this.esAdmin = !!this.miUid && this.miUid === this.ownerUid;
      this.miembros = this.miembros.map(x => ({ ...x, esAdmin: x.uid === this.ownerUid }));

      this.ref.close({ transferido: true, nuevoAdminUid: m.uid });
    } catch (err) {
      console.error(err);
      this.snack.open('No se pudo transferir la administración', 'Cerrar', { duration: 4500 });
    } finally {
      this.loadingTransfer[m.uid] = false;
    }
  }

  confirmarEliminarHogar() {
    if (!this.esAdmin) {
      this.snack.open('Solo el administrador puede eliminar el hogar', 'Cerrar', { duration: 3500 });
      return;
    }

    const ref = this.md.open(ConfirmDeleteHomeDialog, {
      data: { hogarId: this.hogarId },
      disableClose: true,
      autoFocus: false,
      restoreFocus: true
    });

    ref.afterClosed().pipe(take(1)).subscribe(async ok => {
      if (ok !== true) return;
      await this.eliminarHogar();
    });
  }

  private async eliminarHogar() {
    if (this.loading || this.loadingEliminar) return;
    this.loadingEliminar = true;
    try {
      await this.hogarSvc.eliminarHogar(this.hogarId);
      this.snack.open('Hogar eliminado definitivamente', 'Cerrar', { duration: 3500 });
      this.ref.close({ eliminado: true });
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || 'No se pudo eliminar el hogar';
      this.snack.open(msg, 'Cerrar', { duration: 4500 });
    } finally {
      this.loadingEliminar = false;
    }
  }

}

@Component({
  standalone: true,
  selector: 'app-confirm-transfer-dialog',
  template: `
    <div class="confirm-transfer-wrapper">
      <h3 class="titulo">Transferir administración</h3>
      <p class="mensaje">
        ¿Quieres transferir la administración a
        <strong>{{ data.nombre || data.email || ('usuario ' + (data.uid || '').slice(0,6)) }}</strong>?
      </p>

      <div class="acciones">
        <button mat-button mat-dialog-close="false">Rechazar</button>
        <button mat-flat-button color="primary" [mat-dialog-close]="true">Confirmar</button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-transfer-wrapper { padding: .75rem 1rem; max-width: 420px; }
    .titulo { margin: 0 0 .5rem; font-size: 1.05rem; }
    .mensaje { margin: 0 0 .75rem; }
    .acciones { display: flex; justify-content: flex-end; gap: .5rem; }
  `],
  imports: [MatButtonModule, MatDialogModule, CommonModule]
})
export class ConfirmTransferDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { uid: string; nombre?: string | null; email?: string | null }) { }
}

@Component({
  standalone: true,
  selector: 'app-confirm-delete-home-dialog',
  template: `
    <div class="confirm-delete-wrapper">
      <h3 class="titulo">Eliminar hogar</h3>
      <p class="mensaje">
        Esta acción <strong>borra definitivamente</strong> el hogar y todo su contenido.<br>
        Escribe <strong>ELIMINAR</strong> para confirmar.
      </p>

      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Confirmación</mat-label>
        <input matInput [formControl]="confCtrl" autocomplete="off" />
        <mat-error>Escribe exactamente: ELIMINAR</mat-error>
      </mat-form-field>

      <div class="acciones">
        <button mat-button mat-dialog-close="false">Cancelar</button>
        <button mat-flat-button color="warn"
                [disabled]="confCtrl.invalid"
                [mat-dialog-close]="true">
          Eliminar definitivamente
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-delete-wrapper { padding: .9rem 1rem; max-width: 520px; }
    .titulo { margin: 0 0 .5rem; font-size: 1.08rem; }
    .mensaje { margin: 0 .0 1rem; }
    .acciones { display: flex; justify-content: flex-end; gap: .5rem; }
    .w-100 { width: 100%; }
  `],
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatInputModule, ReactiveFormsModule]
})
export class ConfirmDeleteHomeDialog {
  confCtrl = new FormControl<string>('', [Validators.required, Validators.pattern(/^ELIMINAR$/)]);
  constructor(@Inject(MAT_DIALOG_DATA) public data: { hogarId: string }) { }
}
