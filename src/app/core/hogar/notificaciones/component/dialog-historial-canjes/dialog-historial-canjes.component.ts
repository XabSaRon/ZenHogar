import { Component, Inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Observable, of } from 'rxjs';
import { catchError, startWith, map } from 'rxjs/operators';

import { NotificacionesService } from '../../../../hogar/notificaciones/services/notificaciones.service';
import { NotificacionDTO } from '../../../../hogar/notificaciones/model/notificacion.model';
import { ICONO_PREDEFINIDA_POR_ID } from '../../../../tienda/mocks/tienda.mocks';

export interface DialogHistorialCanjesData {
  hogarId: string;
  take?: number;
  currentUid: string;
}

interface CanjesGroup {
  key: string;
  label: string;
  items: NotificacionDTO[];
}

type Vm = { loading: boolean; list: NotificacionDTO[]; groups: CanjesGroup[] };

@Component({
  selector: 'app-dialog-historial-canjes',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './dialog-historial-canjes.component.html',
  styleUrl: './dialog-historial-canjes.component.scss'
})
export class DialogHistorialCanjesComponent {
  readonly vm$: Observable<Vm>;

  constructor(
    private dialogRef: MatDialogRef<DialogHistorialCanjesComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogHistorialCanjesData,
    private notiSvc: NotificacionesService
  ) {
    const take = data.take ?? 80;

    this.vm$ = this.notiSvc.canjesHistorial$(data.hogarId, take).pipe(
      map(list => {
        const items = list ?? [];
        return {
          loading: false,
          list: items,
          groups: this.groupByDay(items)
        };
      }),
      startWith({ loading: true, list: [], groups: [] }),
      catchError(() => of({ loading: false, list: [], groups: [] }))
    );
  }

  close() {
    this.dialogRef.close();
  }

  icono(recompensaId?: string | null): string | null {
    if (!recompensaId) return null;
    return ICONO_PREDEFINIDA_POR_ID[recompensaId] ?? null;
  }

  toDate(createdAt: any): Date | null {
    if (!createdAt) return null;
    if (typeof createdAt?.toDate === 'function') return createdAt.toDate();
    const d = new Date(createdAt);
    return isNaN(d.getTime()) ? null : d;
  }

  isMine(c: NotificacionDTO): boolean {
    return !!this.data?.currentUid && c?.actorUid === this.data.currentUid;
  }

  private groupByDay(items: NotificacionDTO[]): CanjesGroup[] {
    const grouped = new Map<string, NotificacionDTO[]>();

    for (const c of items) {
      const d = this.toDate(c.createdAt) ?? new Date(0);
      const key = this.dayKey(d);

      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(c);
    }

    return Array.from(grouped.entries()).map(([key, groupItems]) => ({
      key,
      label: this.dayLabel(groupItems[0]),
      items: groupItems
    }));
  }

  private dayKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private dayLabel(first: NotificacionDTO): string {
    const d = this.toDate(first.createdAt);
    if (!d) return '—';

    const today = this.startOfDay(new Date());
    const that = this.startOfDay(d);
    const diffDays = Math.round((today.getTime() - that.getTime()) / 86400000);

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';

    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' })
      .format(d)
      .replace('.', '');
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
}
