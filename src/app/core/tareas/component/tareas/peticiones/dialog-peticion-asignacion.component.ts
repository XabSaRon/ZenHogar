import { Component, Inject, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { TareasService } from '../../../services/tareas.service';
import { PeticionAsignacionDTO } from '../../../models/peticion-asignacion.model';
import { AuthService } from '../../../../auth/auth.service';

import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

type UsuarioPublico = { displayName?: string | null; photoURL?: string | null };

@Component({
  standalone: true,
  selector: 'app-dialog-peticion-asignacion',
  templateUrl: './dialog-peticion-asignacion.component.html',
  styleUrls: ['./dialog-peticion-asignacion.component.scss'],
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule]
})
export class DialogPeticionAsignacionComponent implements AfterViewInit {
  peticion: PeticionAsignacionDTO;
  tareaNombre: string;

  solicitanteNombre: string = 'Alguien';
  solicitanteFotoURL: string | null = null;

  private lookupUid?: string;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { peticion: PeticionAsignacionDTO; tareaNombre: string },
    private dialogRef: MatDialogRef<DialogPeticionAsignacionComponent>,
    private tareas: TareasService,
    private snack: MatSnackBar,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.peticion = data.peticion;
    this.tareaNombre = data.tareaNombre;

    if (this.peticion.deNombre?.trim()) {
      this.solicitanteNombre = this.peticion.deNombre.trim();
    }

    this.lookupUid = this.peticion.deUid;
  }

  ngAfterViewInit(): void {
    if (this.lookupUid) {
      Promise.resolve().then(() => {
        this.resolverSolicitante(this.lookupUid!).catch(() => { /* noop */ });
      });
    }
  }

  private async resolverSolicitante(uid: string) {
    if (!uid) return;
    const usuario$ = this.auth.getUsuarioPublico$(uid);

    const u = await firstValueFrom(
      usuario$.pipe(
        map(u => u ?? ({ displayName: null, photoURL: null } as UsuarioPublico))
      )
    );

    if (this.lookupUid !== uid) return;

    if (!this.solicitanteNombre || this.solicitanteNombre === 'Alguien') {
      this.solicitanteNombre = u.displayName ?? 'Alguien';
    }
    this.solicitanteFotoURL = u.photoURL ?? null;

    this.cdr.markForCheck();
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

  onImageError(ev: Event) {
    (ev.target as HTMLImageElement).src = 'assets/default-avatar.png';
  }

  cerrar() {
    this.dialogRef.close(null);
  }

  get tareaEmoji(): string {
    const n = (this.tareaNombre || '').toLowerCase();
    if (n.includes('regar') || n.includes('plant')) return '🌱';
    if (n.includes('barrer')) return '🧹';
    if (n.includes('fregar')) return '🧼';
    if (n.includes('cocina') || n.includes('comida')) return '🍳';
    if (n.includes('ropa') || n.includes('lavar')) return '👕';
    if (n.includes('baño') || n.includes('wc')) return '🚽';
    if (n.includes('basura')) return '🗑️';
    if (n.includes('limpiar')) return '🧽';
    if (n.includes('cama')) return '🛏️';
    if (n.includes('compra') || n.includes('super')) return '🛒';
    return '🏠';
  }
}
