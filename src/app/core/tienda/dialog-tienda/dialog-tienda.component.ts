import { Component, Inject } from '@angular/core';
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
    MatSnackBarModule
  ],
  templateUrl: './dialog-tienda.component.html',
  styleUrls: ['./dialog-tienda.component.scss']
})
export class DialogTiendaComponent {

  private creadorCache = new Map<string, string>();

  readonly LIMITE_PERSONALIZADAS = 3;
  mostrarFormNueva = false;
  guardandoPersonalizada = false;

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
    private auth: AuthService
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

  editarPersonalizada(r: Recompensa) { console.log('Editar personalizada', r); }

  async borrarPersonalizada(r: any): Promise<void> {
    if (!this.esAdmin) return;
    if (!r?.id) return;

    const creador = await this.nombreCreador(r.creadaPor);

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      autoFocus: false,
      panelClass: 'confirm-dialog-panel',
      data: {
        title: 'Eliminar recompensa',
        emphasis: `"${r.titulo}"`,
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

    try {
      // DEMO: solo memoria
      if (this.esDemo) {
        this.personalizadas = this.personalizadas.filter(x => x.id !== r.id);
        this.snackBar.open('Recompensa eliminada (demo) 🗑️', 'Ok', { duration: 2500 });
        return;
      }

      if (!this.hogarId) return;

      await this.tiendaSvc.borrarRecompensaPersonalizada(this.hogarId, r.id);

      this.personalizadas = this.personalizadas.filter(x => x.id !== r.id);
      this.snackBar.open('Recompensa eliminada 🗑️', 'Ok', { duration: 2500 });
    } catch (e) {
      console.error('Error eliminando recompensa', e);
      this.snackBar.open('No se pudo eliminar. Inténtalo de nuevo.', 'Cerrar', { duration: 3500 });
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
    if (this.formNueva.invalid || !this.usuarioId) return;

    this.guardandoPersonalizada = true;

    try {
      const { titulo, descripcion, coste } = this.formNueva.value;

      const nueva: any = {
        id: `demo-${Date.now()}`,
        titulo: (titulo as string).trim(),
        descripcion: (descripcion as string)?.trim() || '',
        coste: Number(coste),
        icono: 'emoji_events',
        creadaPor: this.usuarioId,
        creadaEn: Date.now(),
        tipo: 'personalizada'
      };

      // DEMO: no guardamos en Firestore, solo añadimos a memoria
      if (this.esDemo) {
        this.personalizadas = [...this.personalizadas, nueva];

        this.snackBar.open('Recompensa creada en modo demo ✨', 'Ok', { duration: 2500 });
        this.cancelarForm();
        return;
      }

      // REAL: aquí sí exigimos hogarId y persistimos
      if (!this.hogarId) return;

      const creada = await this.tiendaSvc.crearRecompensaPersonalizada(this.hogarId, nueva);
      const recompensaFinal = creada ?? nueva;

      this.personalizadas = [...this.personalizadas, recompensaFinal];

      this.snackBar.open('Recompensa personalizada creada 🎉', 'Ok', {
        duration: 3000
      });

      this.cancelarForm();
    } catch (e) {
      console.error('Error creando recompensa personalizada', e);
      this.snackBar.open('No se pudo crear la recompensa. Inténtalo de nuevo.', 'Cerrar', {
        duration: 3500
      });
    } finally {
      this.guardandoPersonalizada = false;
    }
  }

  toggleFormNueva(): void {
    if (!this.puedeCrearPersonalizada) return;
    this.mostrarFormNueva = !this.mostrarFormNueva;
  }

  cancelarForm(): void {
    this.mostrarFormNueva = false;
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
    if (uid === this.usuarioId) return 'ti';

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
