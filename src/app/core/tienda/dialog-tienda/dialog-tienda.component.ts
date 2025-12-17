import { Component, Inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { firstValueFrom, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AuthService } from '../../auth/auth.service';
import { TiendaService } from '../services/tienda.service';
import { Recompensa, DialogTiendaData } from '../models/tienda.model';
import { RECOMPENSAS_PREDEFINIDAS_MOCK } from '../mocks/tienda.mocks';
import { ConfirmDialogComponent } from '../../../shared/dialog-confirm/dialog-confirm.component';

@Component({
  selector: 'app-dialog-tienda',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './dialog-tienda.component.html',
  styleUrls: ['./dialog-tienda.component.scss']
})
export class DialogTiendaComponent {

  private creadorCache = new Map<string, string>();

  readonly LIMITE_PERSONALIZADAS = 3;
  mostrarFormNueva = false;
  guardandoPersonalizada = false;
  editandoId: string | null = null;
  borrandoPersonalizadas = new Set<string>();

  puntosDisponibles: number;
  esZenPrime: boolean;
  esDemo: boolean;

  formNueva: FormGroup;
  predefinidas: Recompensa[] = RECOMPENSAS_PREDEFINIDAS_MOCK;
  personalizadas: Recompensa[] = [];
  hogarId?: string;
  usuarioId?: string;
  esAdmin?: boolean;

  constructor(
    private dialogRef: MatDialogRef<DialogTiendaComponent>,
    @Inject(MAT_DIALOG_DATA) data: DialogTiendaData,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
    private tiendaSvc: TiendaService,
    private dialog: MatDialog,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {
    this.puntosDisponibles = data?.puntosDisponibles ?? 0;
    this.esZenPrime = data?.esZenPrime ?? false;
    this.esDemo = !!data?.esDemo;
    this.personalizadas = data?.recompensasPersonalizadas ?? [];
    this.hogarId = data.hogarId;
    this.usuarioId = data.usuarioUid;
    this.esAdmin = data?.esAdmin ?? false;

    this.formNueva = this.fb.group({
      titulo: ['', [Validators.required, Validators.maxLength(60)]],
      descripcion: ['', [Validators.maxLength(200)]],
      coste: [50, [Validators.required, Validators.min(1)]],
    });
  }

  get puedeCrearPersonalizada(): boolean {
    if (this.esDemo) {
      return this.personalizadas.length < 3;
    }

    if (!this.hogarId) return false;

    if (this.esZenPrime) return true;

    return this.personalizadas.length < this.LIMITE_PERSONALIZADAS;
  }

  get totalPersonalizadas(): number {
    return this.personalizadas.length;
  }

  editarPersonalizada(r: Recompensa) {
    if (this.guardandoPersonalizada) return;
    if (!this.esAdmin) return;

    this.mostrarFormNueva = true;
    this.editandoId = r.id ?? null;

    this.formNueva.setValue({
      titulo: r.titulo ?? '',
      descripcion: r.descripcion ?? '',
      coste: r.coste ?? 50,
    });

    this.formNueva.markAsPristine();
    this.formNueva.markAsUntouched();
  }

  estaBorrando(r: any): boolean {
    return !!r?.id && this.borrandoPersonalizadas.has(r.id);
  }

  private marcarBorrando(id: string) {
    this.borrandoPersonalizadas = new Set([...this.borrandoPersonalizadas, id]);
    this.cdr.detectChanges();
  }

  private desmarcarBorrando(id: string) {
    const next = new Set(this.borrandoPersonalizadas);
    next.delete(id);
    this.borrandoPersonalizadas = next;
    this.cdr.detectChanges();
  }

  async borrarPersonalizada(r: any): Promise<void> {
    if (!r?.id) return;
    if (this.borrandoPersonalizadas.has(r.id)) return;
    if (this.guardandoPersonalizada) return;
    if (!this.esAdmin) return;

    const creador = await this.nombreCreador(r.creadaPor);

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      autoFocus: false,
      panelClass: 'confirm-dialog-panel',
      data: {
        title: 'Eliminar recompensa',
        emphasis: r.titulo,
        message:
          `Creada por: ${creador}\n\n` +
          `Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        icon: 'delete',
        tone: 'warn'
      }
    });

    const ok = await firstValueFrom(ref.afterClosed());
    if (!ok) return;

    await new Promise<void>(resolve => setTimeout(resolve, 0));
    this.marcarBorrando(r.id);
    await new Promise<void>(res => requestAnimationFrame(() => res()));

    const t0 = performance.now();
    const minMs = 200;

    try {
      if (this.esDemo) {
        const dt = performance.now() - t0;
        if (dt < minMs) await new Promise<void>(res => setTimeout(res, minMs - dt));

        this.personalizadas = this.personalizadas.filter(x => x.id !== r.id);
        this.cdr.detectChanges();
        this.snackBar.open('Recompensa eliminada (demo) 🗑️', 'Ok', { duration: 2500 });
        return;
      }

      if (!this.hogarId) {
        const dt = performance.now() - t0;
        if (dt < minMs) await new Promise<void>(res => setTimeout(res, minMs - dt));

        this.snackBar.open('No se pudo completar la acción: falta el hogar.', 'Cerrar', { duration: 3000 });
        return;
      }

      await this.tiendaSvc.borrarRecompensaPersonalizada(this.hogarId, r.id);

      const dt = performance.now() - t0;
      if (dt < minMs) await new Promise<void>(res => setTimeout(res, minMs - dt));

      this.personalizadas = this.personalizadas.filter(x => x.id !== r.id);
      this.cdr.detectChanges();
      this.snackBar.open('Recompensa eliminada 🗑️', 'Ok', { duration: 2500 });
    } catch (e) {
      console.error('Error eliminando recompensa', e);

      const dt = performance.now() - t0;
      if (dt < minMs) await new Promise<void>(res => setTimeout(res, minMs - dt));

      this.snackBar.open('No se pudo eliminar. Inténtalo de nuevo.', 'Cerrar', { duration: 3500 });
    } finally {
      this.desmarcarBorrando(r.id);
    }
  }

  puntosRestantes(r: Recompensa): number {
    return (this.puntosDisponibles ?? 0) - (r?.coste ?? 0);
  }

  puedeCanjear(r: Recompensa): boolean {
    if (r.soloZenPrime && !this.esZenPrime) return false;
    return this.puntosDisponibles >= r.coste;
  }

  canjear(r: Recompensa): void {
    if (!this.puedeCanjear(r)) return;

    // DEMO: solo snackbar
    if (this.esDemo) {
      this.snackBar.open(
        `"${r.titulo}" canjeado en modo demo. En la versión real se descontarán tus puntos ✨`,
        'Vale',
        { duration: 3500 }
      );
      return;
    }

    // REAL: devolvemos info al padre
    this.dialogRef.close({
      accion: 'canjear',
      recompensa: r,
      puntosGastados: r.coste
    });
  }

  tooltipCanjear(r: Recompensa): string {
    if (r?.soloZenPrime && !this.esZenPrime) {
      return 'Solo disponible con ZenPrime ⚡';
    }

    const restantes = this.puntosRestantes(r);

    if (restantes >= 0) {
      return `Te quedarán ${restantes} puntos`;
    }

    return `Te faltan ${Math.abs(restantes)} puntos 😅`;
  }

  async guardarRecompensaPersonalizada(): Promise<void> {
    if (this.formNueva.invalid) return;
    if (!this.usuarioId && !this.esDemo) return;

    this.guardandoPersonalizada = true;

    try {
      const { titulo, descripcion, coste } = this.formNueva.value;

      const payload = {
        titulo: (titulo as string).trim(),
        descripcion: (descripcion as string)?.trim() || '',
        coste: Number(coste),
        actualizadaEn: Date.now()
      };

      // EDITAR
      if (this.editandoId) {
        const id = this.editandoId;

        // Demo
        if (this.esDemo) {
          this.personalizadas = this.personalizadas.map(x =>
            x.id === id ? { ...x, ...payload } : x
          );
          this.snackBar.open('Recompensa actualizada (demo) ✏️', 'Ok', { duration: 2500 });
          this.cancelarForm();
          return;
        }

        if (!this.hogarId) {
          this.snackBar.open('No se pudo completar la acción: falta el hogar.', 'Cerrar', { duration: 3000 });
          return;
        }

        await this.tiendaSvc.actualizarRecompensaPersonalizada(this.hogarId, id, payload);

        this.personalizadas = this.personalizadas.map(x =>
          x.id === id ? { ...x, ...payload } : x
        );

        this.snackBar.open('Recompensa actualizada ✏️', 'Ok', { duration: 2500 });
        this.cancelarForm();
        return;
      }

      const nueva: any = {
        id: `rw-${crypto.randomUUID()}`,
        titulo: payload.titulo,
        descripcion: payload.descripcion,
        coste: payload.coste,
        icono: 'emoji_events',
        creadaPor: this.usuarioId ?? 'demo',
        creadaEn: Date.now(),
        tipo: 'personalizada'
      };

      if (this.esDemo) {
        this.personalizadas = [...this.personalizadas, nueva];
        this.snackBar.open('Recompensa creada en modo demo ✨', 'Ok', { duration: 2500 });
        this.cancelarForm();
        return;
      }

      if (!this.hogarId) {
        this.snackBar.open('No se pudo completar la acción: falta el hogar.', 'Cerrar', { duration: 3000 });
        return;
      }

      const creada = await this.tiendaSvc.crearRecompensaPersonalizada(this.hogarId, nueva);
      this.personalizadas = [...this.personalizadas, (creada ?? nueva)];

      this.snackBar.open('Recompensa personalizada creada 🎉', 'Ok', { duration: 3000 });
      this.cancelarForm();

    } catch (e) {
      console.error('Error guardando recompensa', e);
      this.snackBar.open('No se pudo guardar. Inténtalo de nuevo.', 'Cerrar', { duration: 3500 });
    } finally {
      this.guardandoPersonalizada = false;
    }
  }

  toggleFormNueva(): void {
    if (!this.puedeCrearPersonalizada) return;

    if (this.mostrarFormNueva) {
      this.cancelarForm();
      return;
    }

    this.editandoId = null;
    this.mostrarFormNueva = true;
  }

  cancelarForm(): void {
    this.mostrarFormNueva = false;
    this.editandoId = null;

    this.formNueva.reset({
      titulo: '',
      descripcion: '',
      coste: 50
    });
  }

  cerrar(): void {
    this.dialogRef.close();
  }

  private async nombreCreador(uid?: string): Promise<string> {
    if (!uid) return 'desconocido';
    if (uid === 'demo') return 'demo';
    if (this.usuarioId && uid === this.usuarioId) return 'ti';

    const cached = this.creadorCache.get(uid);
    if (cached) return cached;

    const nombre = await firstValueFrom(
      this.auth.getUsuarioPublico$(uid).pipe(
        map(u => u?.displayName?.trim() || null),
        catchError(() => of(null))
      )
    );

    const final = nombre ?? `usuario ${uid.slice(0, 6)}…`;
    this.creadorCache.set(uid, final);
    return final;
  }
}
