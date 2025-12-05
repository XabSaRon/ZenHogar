import { Component, inject, Inject, ChangeDetectorRef, NgZone } from '@angular/core';
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
import { MatCheckboxModule } from '@angular/material/checkbox';

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

type TransferData = {
  uid: string;
  nombre?: string | null;
  email?: string | null;
  fotoURL?: string | null;
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
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

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
    if (!this.loading && !this.loadingEliminar) this.ref.close();
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
    this.cdr.detectChanges();

    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    try {
      await this.zone.runOutsideAngular(async () => {
        await this.hogarSvc.eliminarHogar(this.hogarId);
      });

      this.zone.run(() => {
        this.snack.open('Hogar eliminado definitivamente', 'Cerrar', { duration: 3500 });
        this.ref.close({ eliminado: true });
      });
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || 'No se pudo eliminar el hogar';
      this.zone.run(() => this.snack.open(msg, 'Cerrar', { duration: 4500 }));
      this.loadingEliminar = false;
      this.cdr.detectChanges();
    }
  }
}

@Component({
  standalone: true,
  selector: 'app-confirm-transfer-dialog',
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatCheckboxModule],
  template: `
    <div class="dlg">
      <header class="dlg__header">
        <span class="pill"><mat-icon fontIcon="supervisor_account"></mat-icon></span>
        <h3 class="title">Transferir administración</h3>
      </header>

      <section class="target">
        <div class="avatar" [class.avatar--img]="data.fotoURL">
          @if (data.fotoURL) {
            <img [src]="data.fotoURL!" alt="Avatar" (error)="onImgError($event)">
          } @else {
            <span>{{ initials() }}</span>
          }
        </div>
        <div class="who">
          <div class="name">{{ displayName() }}</div>
          @if (data.email) {
            <div class="mail">{{ data.email }}</div>
          }
          <div class="note">Será el nuevo <strong>administrador del hogar</strong>.</div>
        </div>
      </section>

      <div class="info" role="note">
        <mat-icon fontIcon="info"></mat-icon>
        <div>
          Perderás permisos de administración (Expulsar miembros (futuro), editar nombre del hogar y eliminarlo).
          Seguirás siendo miembro del hogar.
        </div>
      </div>

      <mat-checkbox class="consent" [(ngModel)]="consent">
        Sí, quiero transferir la administración a <strong>{{ shortName() }}</strong>.
      </mat-checkbox>

      <div class="actions">
        <button mat-button mat-dialog-close="false" class="btn-cancel">Rechazar</button>
        <button mat-flat-button color="primary" [disabled]="!consent" [mat-dialog-close]="true">
          Confirmar
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dlg {
      padding: 1rem 1.25rem 1rem;
      max-width: 520px;
      background: linear-gradient(135deg,#f6fbff,#f8fff6);
      border-radius: 16px;
    }

    .dlg__header {
      display:flex; align-items:center; gap:.65rem; margin-bottom:.35rem;
    }
    .title{ margin:0; font-size:1.12rem; line-height:1.2; }

    .pill{
      width:34px;height:34px; display:inline-grid; place-items:center; border-radius:999px;
      background:linear-gradient(135deg,#e3f2fd,#e8f5e9);
      box-shadow:0 3px 10px rgba(0,0,0,.08) inset,0 1px 2px rgba(0,0,0,.06);
    }
    .pill .mat-icon{ font-size:18px;width:18px;height:18px;color:#2e7d32; }

    .target{
      display:grid; grid-template-columns:auto 1fr; gap:.75rem; align-items:center;
      padding:.75rem .85rem; background:#fff; border:1px solid rgba(0,0,0,.06); border-radius:12px;
      margin:.25rem 0 .75rem;
    }
    .avatar{
      width:44px;height:44px; border-radius:50%; display:grid; place-items:center;
      background:linear-gradient(135deg,#e0f2f1,#e3f2fd); color:#245;
      font-weight:700; letter-spacing:.3px; text-transform:uppercase;
      overflow:hidden; box-shadow:0 1px 2px rgba(0,0,0,.06) inset;
    }
    .avatar--img{ background:none; }
    .avatar img{ width:100%; height:100%; object-fit:cover; }

    .who{ display:grid; gap:.15rem; }
    .name{ font-weight:600; }
    .mail{ font-size:.9rem; opacity:.8; }
    .note{ font-size:.88rem; color:#566; }

    .info{
      display:grid; grid-template-columns:auto 1fr; gap:.5rem; align-items:flex-start;
      padding:.6rem .75rem; background:rgba(33,150,243,.05); border:1px dashed rgba(33,150,243,.28);
      border-radius:12px; margin-bottom:.5rem;
    }
    .info mat-icon{ color:#1976d2; }

    .consent{
      margin:.25rem 0 .25rem;
      --mdc-checkbox-selected-focus-state-layer-color: currentColor;
    }

    .actions{
      display:flex; justify-content:flex-end; gap:.5rem; margin-top:.5rem;
    }
    .btn-cancel{ font-weight:600; }

    @media (max-width:480px){
      .dlg{ padding:.9rem; }
      .title{ font-size:1.06rem; }
      .avatar{ width:40px; height:40px; }
    }
  `]
})
export class ConfirmTransferDialog {
  consent = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: TransferData) { }

  displayName = () =>
    (this.data.nombre?.trim()) ||
    (this.data.email?.trim()) ||
    ('Usuario ' + (this.data.uid || '').slice(0, 6));

  shortName = () =>
    (this.data.nombre?.split(' ')[0]) ||
    (this.data.email?.split('@')[0]) ||
    (this.data.uid || '').slice(0, 6);

  initials = () => {
    const src = this.displayName();
    const parts = src.split(/\s+/).filter(Boolean);
    const take = (s: string) => s.substring(0, 1).toUpperCase();
    return parts.length >= 2 ? take(parts[0]) + take(parts[1]) : take(parts[0]);
  };

  onImgError(ev: Event) {
    (ev.target as HTMLImageElement).style.display = 'none';
  }
}

@Component({
  standalone: true,
  selector: 'app-confirm-delete-home-dialog',
  template: `
    <div class="dlg">
      <header class="dlg__header">
        <span class="pill">
          <mat-icon fontIcon="warning_amber"></mat-icon>
        </span>
        <h3 class="title">Eliminar hogar</h3>
      </header>

      <div class="danger-box" role="alert">
        <p class="lead">
          Esta acción <strong>borra definitivamente</strong> el hogar y todo su contenido.
        </p>
        <p class="help">
          Para confirmar, escribe <span class="badge">ELIMINAR</span> en el campo de abajo.
        </p>
      </div>

      <form class="form" autocomplete="off" spellcheck="false">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Confirmación</mat-label>
          <input
            matInput
            [formControl]="confCtrl"
            cdkFocusInitial
            aria-describedby="confirm-help"
            inputmode="latin"
          />
          <mat-error>Escribe exactamente: ELIMINAR</mat-error>
          <mat-hint id="confirm-help">Escribe la palabra mostrada arriba.</mat-hint>
        </mat-form-field>

        <div class="actions">
          <button mat-button mat-dialog-close="false" class="btn-cancel">Cancelar</button>
          <button
            mat-flat-button
            color="warn"
            [disabled]="confCtrl.invalid"
            [mat-dialog-close]="true"
          >
            Eliminar definitivamente
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .dlg {
      padding: 1rem 1.25rem 1rem;
      max-width: 520px;
      background: linear-gradient(135deg, #f6fbff, #fef7f7);
      border-radius: 16px;
    }

    .dlg__header {
      display: flex;
      align-items: center;
      gap: .65rem;
      margin-bottom: .35rem;
    }
    .title {
      margin: 0;
      font-size: 1.12rem;
      line-height: 1.2;
    }

    .pill {
      width: 34px; height: 34px;
      display: inline-grid; place-items: center;
      border-radius: 999px;
      background: linear-gradient(135deg, #fff3e0, #ffebee);
      box-shadow: 0 3px 10px rgba(0,0,0,.08) inset, 0 1px 2px rgba(0,0,0,.06);
    }
    .pill .mat-icon { width: 18px; height: 18px; font-size: 18px; color: #e53935; }

    .danger-box {
      margin: .25rem 0 .75rem;
      padding: .75rem .85rem;
      background: rgba(229, 57, 53, .04);
      border: 1px dashed rgba(229, 57, 53, .28);
      border-radius: 12px;
    }
    .lead { margin: 0 0 .25rem 0; }
    .help { margin: 0; color: #6b6b6b; }
    .badge {
      display: inline-block;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-weight: 700;
      letter-spacing: .5px;
      padding: .1rem .45rem;
      border-radius: 999px;
      background: #ffe0e0;
      color: #c62828;
    }

    .form { margin-top: .25rem; }
    .w-100 { width: 100%; }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: .5rem;
      margin-top: .25rem;
    }
    .btn-cancel { font-weight: 600; }

    @media (max-width: 480px) {
      .dlg { padding: .9rem .9rem .85rem; }
      .pill { width: 30px; height: 30px; }
      .title { font-size: 1.06rem; }
    }
  `],
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatInputModule, ReactiveFormsModule, MatIconModule]
})
export class ConfirmDeleteHomeDialog {
  confCtrl = new FormControl<string>('', [Validators.required, Validators.pattern(/^ELIMINAR$/)]);
  constructor(@Inject(MAT_DIALOG_DATA) public data: { hogarId: string }) { }
}
