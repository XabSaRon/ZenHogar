import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { catchError, tap, map, take } from 'rxjs/operators';

import { NotificacionDTO } from '../../../../hogar/notificaciones/model/notificacion.model';
import { NotificacionesService } from '../../../../hogar/notificaciones/services/notificaciones.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ICONO_PREDEFINIDA_POR_ID } from '../../../../tienda/mocks/tienda.mocks';
import { DialogHistorialCanjesComponent } from '../dialog-historial-canjes/dialog-historial-canjes.component';


@Component({
  selector: 'app-actividad-hogar',
  standalone: true,
  imports: [CommonModule, MatTooltipModule, MatIconModule],
  templateUrl: './actividad-hogar.component.html',
  styleUrl: './actividad-hogar.component.scss',
})
export class ActividadHogarComponent {
  private _hogarId: string | null = null;

  maxVisible = 3;
  expanded = false;

  readonly take = 6;

  canjes$: Observable<NotificacionDTO[]> = of([]);
  canjes: NotificacionDTO[] = [];

  totalCanjes$ = of(0);
  totalCanjes = 0;

  @Input()
  set hogarId(value: string | null | undefined) {
    const v = (value ?? '').trim();
    this._hogarId = v || null;

    if (!this._hogarId) {
      this.canjes$ = of([]);
      this.totalCanjes$ = of(0);
      this.totalCanjes = 0;
      this.expanded = false;
      this.canjes = [];
      return;
    }

    this.totalCanjes$ = this.notiSvc.canjes$(this._hogarId).pipe(
      map(list => (list?.length ?? 0)),
      catchError(() => of(0)),
      tap(total => {
        this.totalCanjes = total ?? 0;
        if (this.totalCanjes <= this.maxVisible) this.expanded = false;
      })
    );

    this.canjes$ = this.notiSvc.canjesRecientes$(this._hogarId, this.take).pipe(
      catchError(() => of([])),
      tap(list => {
        this.canjes = list ?? [];
      })
    );
  }

  constructor(private notiSvc: NotificacionesService, private dialog: MatDialog, private authSvc: AuthService) { }

  tooltip(c: NotificacionDTO): string {
    const actor = c.actorNombre ?? 'Alguien';
    const titulo = c.recompensaTitulo ?? 'Recompensa';
    const coste = c.coste ?? 0;
    return `${actor} · ${titulo} · −${coste} pts`;
  }

  getIconoMaterial(recompensaId?: string | null): string | null {
    if (!recompensaId) return null;
    return ICONO_PREDEFINIDA_POR_ID[recompensaId] ?? null;
  }

  get hasOverflow(): boolean {
    return (this.totalCanjes ?? 0) > this.maxVisible;
  }

  get chipsVisibles(): number {
    return (this.expanded && this.hasOverflow) ? 5 : 3;
  }

  get visiblesAhora(): number {
    return Math.min(this.chipsVisibles, this.canjes.length);
  }

  get restantes(): number {
    return Math.max(0, (this.totalCanjes ?? 0) - this.visiblesAhora);
  }

  toggleExpanded(ev?: Event) {
    ev?.stopPropagation();
    if (!this.hasOverflow) return;
    this.expanded = !this.expanded;
  }

  abrirHistorial() {
    if (!this._hogarId) return;

    this.authSvc.user$.pipe(take(1)).subscribe(u => {
      const uid = u?.uid;
      if (!uid) return;

      this.dialog.open(DialogHistorialCanjesComponent, {
        maxWidth: '820px',
        width: '92vw',
        autoFocus: false,
        panelClass: 'zen-dialog',
        data: { hogarId: this._hogarId, take: 120, currentUid: uid }
      });
    });
  }

}
