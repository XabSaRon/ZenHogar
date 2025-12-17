import { CommonModule } from '@angular/common';
import { Component, Input, ViewChild, Output, EventEmitter } from '@angular/core';
import { Observable, of, firstValueFrom, combineLatest } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuTrigger } from '@angular/material/menu';
import { MatIconButton, MatButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatBadge } from '@angular/material/badge';

import { TareasService } from '../../services/tareas.service';
import { PeticionAsignacionDTO } from '../../models/peticion-asignacion.model';
import { NotificacionesService } from '../../../hogar/notificaciones/services/notificaciones.service';


type NotiVM = {
  id: string;
  tipo: 'rechazo' | 'aceptada' | 'canje';
  tareaId?: string;
  hogarId: string;
  quien: string;
  fecha: Date | null;
  recompensaTitulo?: string;
  coste?: number;
};

@Component({
  selector: 'app-notificador',
  standalone: true,
  imports: [
    CommonModule,
    MatIcon,
    MatMenu, MatMenuTrigger,
    MatIconButton, MatButton,
    MatTooltip,
    MatBadge,
  ],
  templateUrl: './notificador.component.html',
  styleUrls: ['./notificador.component.scss'],
})
export class NotificadorComponent {
  private _uidSolicitante = '';

  private _hogarId: string | null = null;

  @Input()
  set hogarId(v: string | null | undefined) {
    this._hogarId = v ?? null;
    this._buildStreams();
  }

  @Input({ required: true })
  set uidSolicitante(v: string) {
    this._uidSolicitante = v ?? '';
    this._buildStreams();
  }
  @Output() verTarea = new EventEmitter<string>();

  @ViewChild(MatMenuTrigger, { static: false }) menuTrigger?: MatMenuTrigger;

  notifications$: Observable<NotiVM[]> = of([]);
  total$: Observable<number> = of(0);

  private nombreCache = new Map<string, Observable<string>>();

  constructor(private tareasSrv: TareasService, private notiSrv: NotificacionesService) { }

  private toDate(v: any): Date | null {
    try {
      if (!v) return null;
      if (v instanceof Date) return v;
      if (typeof v?.toDate === 'function') return v.toDate();
      const d = new Date(v);
      return isNaN(+d) ? null : d;
    } catch {
      return null;
    }
  }

  private _buildStreams(): void {
    if (!this._uidSolicitante) {
      this.notifications$ = of([]);
      this.total$ = of(0);
      return;
    }

    const rechazadas$ = this.tareasSrv.rechazosParaSolicitante$(this._uidSolicitante).pipe(
      map(list => (list ?? [])
        .filter((p): p is PeticionAsignacionDTO & { id: string } => !!p?.id)
        .map<NotiVM>(p => ({
          id: p.id!,
          tipo: 'rechazo',
          tareaId: p.tareaId,
          hogarId: p.hogarId,
          quien: p.rechazadaPorNombre ?? p.paraNombre ?? 'usuario',
          fecha: this.toDate(p.rechazadaEn),
        })))
    );

    const aceptadas$ = this.tareasSrv.aceptadasParaSolicitante$(this._uidSolicitante).pipe(
      map(list => (list ?? [])
        .filter((p): p is PeticionAsignacionDTO & { id: string } =>
          !!p?.id && p.aceptacionNotificadaSolicitante !== true)
        .map<NotiVM>(p => ({
          id: p.id!,
          tipo: 'aceptada',
          tareaId: p.tareaId,
          hogarId: p.hogarId,
          quien: p.aceptadaPorNombre ?? p.paraNombre ?? 'usuario',
          fecha: this.toDate(p.aceptadaEn),
        })))
    );

    const canjes$ = this._hogarId
      ? this.notiSrv.notificacionesPendientes$(this._hogarId, this._uidSolicitante).pipe(
        map(list => (list ?? [])
          .filter(n => n.tipo === 'canje')
          .map<NotiVM>(n => ({
            id: n.id!,
            tipo: 'canje',
            hogarId: n.hogarId,
            quien: n.actorNombre ?? 'alguien',
            fecha: this.toDate(n.createdAt),
            recompensaTitulo: n.recompensaTitulo,
            coste: n.coste,
          })))
      )
      : of([] as NotiVM[]);

    this.notifications$ = combineLatest([rechazadas$, aceptadas$, canjes$]).pipe(
      map(([r, a, c]) => [...r, ...a, ...c]
        .sort((x, y) => (y.fecha?.getTime() ?? 0) - (x.fecha?.getTime() ?? 0))),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.total$ = this.notifications$.pipe(map(arr => arr.length));
  }

  getTareaNombre$(hogarId: string, tareaId: string): Observable<string> {
    if (!hogarId || !tareaId) return of('Tarea');
    const key = `${hogarId}:${tareaId}`;
    const cached = this.nombreCache.get(key);
    if (cached) return cached;

    const obs = this.tareasSrv.getTareasPorHogar(hogarId, false).pipe(
      map(lista => lista.find(t => t.id === tareaId)?.nombre ?? 'Tarea'),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.nombreCache.set(key, obs);
    return obs;
  }

  async marcarUnaComoVista(n: NotiVM): Promise<void> {
    if (n.tipo === 'rechazo') return this.tareasSrv.marcarRechazoNotificado(n.id);
    if (n.tipo === 'aceptada') return this.tareasSrv.marcarAceptacionNotificada(n.id);

    if (!this._hogarId) return;
    return this.notiSrv.marcarComoVista(this._hogarId, n.id, this._uidSolicitante);
  }

  async marcarTodoComoVisto(): Promise<void> {
    try {
      const lista = await firstValueFrom(this.notifications$);
      await Promise.all(lista.map(n => this.marcarUnaComoVista(n)));
    } finally {
      this.menuTrigger?.closeMenu();
    }
  }

  async onClickVer(n: NotiVM) {
    this.verTarea.emit(n.tareaId);
    try { await this.marcarUnaComoVista(n); } catch { }
    this.menuTrigger?.closeMenu();
  }
}

