import { Component, inject, OnInit, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest, of, BehaviorSubject } from 'rxjs';
import { switchMap, map, filter } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef, inject as di } from '@angular/core';

import {
  Firestore,
  doc,
  docData,
  DocumentData,
  updateDoc
} from '@angular/fire/firestore';

import { AuthService } from '../../../auth/auth.service';
import { HogarService } from '../../../hogar/services/hogar.service';
import { TareasService } from '../../services/tareas.service';
import { TareaDTO } from '../../models/tarea.model';
import { TarjetaTareaComponent } from './tarjeta-tarea.component';
import { DEMO_MIEMBROS, generarTareasDemo } from '../../utilidades/demo-data';
import { DialogCrearHogarComponent } from '../../../hogar/component/dialog-crear-hogar';
import { DialogUnirseCodigo } from '../../../invitaciones/component/unirse/dialog-unirse-codigo';

import { User } from '@angular/fire/auth';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Auth } from '@angular/fire/auth';

type EstadoFiltro = 'todos' | 'sin_asignar' | 'en_curso' | 'pendiente_valoracion';

@Component({
  selector: 'app-lista-tareas',
  standalone: true,
  imports: [CommonModule, AsyncPipe, TarjetaTareaComponent, MatIconModule, MatButtonModule],
  templateUrl: './lista-tareas.component.html',
  styleUrls: ['./lista-tareas.component.scss'],
})
export class ListaTareasComponent implements OnInit {
  private auth = inject(AuthService);
  private hogar = inject(HogarService);
  private tareas = inject(TareasService);
  private fs = inject(Firestore);
  private snackBar = inject(MatSnackBar);
  private destroyRef = di(DestroyRef);
  private dialog = inject(MatDialog);
  private fbAuth = inject(Auth);

  private usuarioSeleccionado$ = new BehaviorSubject<string | null>(null);
  uidSeleccionado: string | null = null;
  uidSeleccionadoNombre: string | null = null;
  uidSeleccionadoFoto: string | null = null;

  private estadoSeleccionado$ = new BehaviorSubject<EstadoFiltro>('todos');
  mostrarFiltroEstado = false;
  get estadoSeleccionadoLabel(): string {
    const m: Record<EstadoFiltro, string> = {
      'todos': 'Todas las tarjetas',
      'sin_asignar': 'Sin asignar',
      'en_curso': 'En curso',
      'pendiente_valoracion': 'Pendiente valoración'
    };
    return m[this.estadoSeleccionado$.value];
  }

  get estadoIcon(): string {
    const m: Record<EstadoFiltro, string> = {
      todos: '🗂️',
      sin_asignar: '🔓',
      en_curso: '⏳',
      pendiente_valoracion: '⭐',
    };
    return m[this.estadoSeleccionado$.value];
  }

  @ViewChild('dropdown') dropdown?: ElementRef<HTMLElement>;
  @ViewChild('trigger') trigger?: ElementRef<HTMLElement>;
  @ViewChild('dropdownEstado') dropdownEstado?: ElementRef<HTMLElement>;
  @ViewChild('triggerEstado') triggerEstado?: ElementRef<HTMLElement>;

  usuario$ = this.auth.user$;
  usuarioActual: User | null = null;
  mostrarFiltro = false;

  miembros: { uid: string; nombre: string; fotoURL?: string }[] = [];
  isGuest$ = this.usuario$.pipe(map(u => !u));
  usuarioSinHogar$ = combineLatest([this.usuario$, this.hogar.getHogar$()]).pipe(
    map(([u, h]) => !!u && !h)
  );

  private tieneValoracionPendiente(t: TareaDTO): boolean {
    return !!t.bloqueadaHastaValoracion || (t.valoracionesPendientes?.length ?? 0) > 0;
  }

  private esEnCurso(t: TareaDTO): boolean {
    return !!t.asignadA && !t.completada && !this.tieneValoracionPendiente(t);
  }

  private esSinAsignar(t: TareaDTO): boolean {
    return !t.asignadA && !this.tieneValoracionPendiente(t);
  }

  private aplicarFiltroEstado(tareas: TareaDTO[], estado: EstadoFiltro): TareaDTO[] {
    switch (estado) {
      case 'todos':
        return tareas;
      case 'sin_asignar':
        return tareas.filter(t => this.esSinAsignar(t));
      case 'en_curso':
        return tareas.filter(t => this.esEnCurso(t));
      case 'pendiente_valoracion':
        return tareas.filter(t => this.tieneValoracionPendiente(t));
    }
  }

  private baseTareas$ = combineLatest([this.usuario$, this.usuarioSeleccionado$]).pipe(
    switchMap(([usuario, uidSeleccionado]) => {
      if (!usuario) {
        return this.miembros$.pipe(
          map(miembros => {
            const tareasDemo = generarTareasDemo();
            const conAsignacionesDemo = this.asignarDemoEnCaliente(tareasDemo, miembros);
            return uidSeleccionado
              ? conAsignacionesDemo.filter(t => t.asignadA === uidSeleccionado)
              : conAsignacionesDemo;
          })
        );
      }

      return this.hogar.getHogar$().pipe(
        switchMap(hogar => {
          if (!hogar) return of([] as TareaDTO[]);
          return this.tareas.getTareasPorHogar(hogar.id!).pipe(
            map(tareas => uidSeleccionado ? tareas.filter(t => t.asignadA === uidSeleccionado) : tareas)
          );
        })
      );
    })
  );

  tareas$ = combineLatest([this.baseTareas$, this.estadoSeleccionado$]).pipe(
    map(([tareas, estado]) => this.aplicarFiltroEstado(tareas, estado))
  );

  miembros$ = this.usuario$.pipe(
    switchMap(usuario => {
      if (!usuario) {
        return of(DEMO_MIEMBROS);
      }
      return this.hogar.getHogar$().pipe(
        switchMap((hogar) => {
          if (!hogar?.miembros?.length) return of([]);
          const miembros$ = hogar.miembros.map((uid) =>
            docData(doc(this.fs, 'usuarios', uid)).pipe(
              filter((usuario): usuario is DocumentData => !!usuario),
              map((usuario) => ({
                uid,
                nombre: usuario['nombre'] || usuario['displayName'] || 'Desconocido',
                fotoURL: usuario['photoURL'] || '',
              }))
            )
          );
          return combineLatest(miembros$);
        })
      );
    })
  );

  ngOnInit(): void {
    this.usuario$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(usuario => {
        this.usuarioActual = usuario;
        this.filtrarPorUsuario(null);
      });

    this.miembros$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(lista => this.miembros = lista);
  }

  toggleFiltro(ev: MouseEvent) {
    ev.stopPropagation();
    this.mostrarFiltro = !this.mostrarFiltro;
    if (this.mostrarFiltro) this.mostrarFiltroEstado = false;
  }

  toggleFiltroEstado(ev: MouseEvent) {
    ev.stopPropagation();
    this.mostrarFiltroEstado = !this.mostrarFiltroEstado;
    if (this.mostrarFiltroEstado) this.mostrarFiltro = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    const target = ev.target as Node;

    if (this.mostrarFiltro) {
      const insideDropdown = this.dropdown?.nativeElement.contains(target) ?? false;
      const insideTrigger = this.trigger?.nativeElement.contains(target) ?? false;
      if (!insideDropdown && !insideTrigger) {
        this.mostrarFiltro = false;
      }
    }

    if (this.mostrarFiltroEstado) {
      const insideDropdownE = this.dropdownEstado?.nativeElement.contains(target) ?? false;
      const insideTriggerE = this.triggerEstado?.nativeElement.contains(target) ?? false;
      if (!insideDropdownE && !insideTriggerE) {
        this.mostrarFiltroEstado = false;
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.mostrarFiltro = false;
    this.mostrarFiltroEstado = false;
  }

  filtrarPorUsuario(uid: string | null) {
    this.uidSeleccionado = uid;
    this.mostrarFiltro = false;

    if (uid === null) {
      this.uidSeleccionadoNombre = null;
      this.uidSeleccionadoFoto = null;
    } else {
      const user = this.miembros.find(m => m.uid === uid);
      this.uidSeleccionadoNombre = user?.nombre || null;
      this.uidSeleccionadoFoto = user?.fotoURL || null;
    }

    this.usuarioSeleccionado$.next(uid);
  }

  filtrarPorEstado(estado: EstadoFiltro) {
    this.estadoSeleccionado$.next(estado);
    this.mostrarFiltroEstado = false;
  }

  loginConGoogle() { this.auth.loginGoogle(); }

  invitaALogin() {
    this.snackBar.open('🔒 Inicia sesión para asignar y valorar tareas.', 'Iniciar sesión', { duration: 4000 })
      .onAction().subscribe(() => this.loginConGoogle());
  }

  reasignarTarea(tareaId: string | undefined, nuevoUid: string) {
    if (!tareaId) return;

    if (!this.usuarioActual) {
      this.invitaALogin();
      return;
    }

    this.tareas.asignarTarea(tareaId, nuevoUid).catch((err) => {
      const msg =
        err?.message === 'No se puede asignar esta tarea hasta que se complete la valoración.'
          ? '❌ No se puede asignar esta tarea hasta que todos valoren cómo se ha hecho.'
          : err?.message === 'Solo quien la tiene en curso puede reasignar.'
            ? '⛔ Solo quien la tiene en curso puede reasignar.'
            : '❌ Error al asignar tarea';

      this.snackBar.open(msg, 'Cerrar', { duration: 3000 });
      console.error('Error al asignar tarea', err);
    });
  }

  tareasAsignadas$ = this.usuario$.pipe(
    switchMap(usuario => {
      if (!usuario) return of([]);
      return this.hogar.getHogar$().pipe(
        switchMap(hogar => hogar
          ? this.tareas.getTareasAsignadasUsuario(hogar.id!, usuario.uid)
          : of([]))
      );
    })
  );

  puntosSemana$ = this.usuario$.pipe(
    switchMap(usuario => {
      if (!usuario) return of(0);
      return this.hogar.getHogar$().pipe(
        switchMap(hogar => hogar
          ? this.tareas.getPuntosSemana(hogar.id!, usuario.uid)
          : of(0))
      );
    })
  );

  async finalizarTarea(tarea: TareaDTO) {
    if (!this.usuarioActual) {
      this.invitaALogin();
      return;
    }

    const ahora = new Date().toISOString();

    const historialItem = {
      uid: this.usuarioActual.uid,
      nombre: this.usuarioActual.displayName || 'Usuario desconocido',
      fotoURL: this.usuarioActual.photoURL || '',
      fecha: ahora,
      completada: true,
      hogarId: tarea.hogarId,
    };

    const tareaRef = doc(this.fs, 'tareas', tarea.id!);

    const valoracionesPendientes = this.miembros
      .filter(m => m.uid !== tarea.asignadA)
      .map(m => m.uid);

    try {
      await updateDoc(tareaRef, {
        completada: true,
        historial: [...(tarea.historial || []), historialItem],
        asignadA: null,
        asignadoNombre: null,
        asignadoFotoURL: null,
        valoraciones: [],
        valoracionesPendientes,
        bloqueadaHastaValoracion: true,
      });

      this.snackBar.open('✅ Tarea completada, pendiente de valoración', 'Cerrar', { duration: 3000 });
    } catch {
      this.snackBar.open('❌ Error al marcar como completada', 'Cerrar', { duration: 3000 });
    }
  }

  tareasParaValorar$ = combineLatest([this.baseTareas$, this.usuario$]).pipe(
    map(([tareas, usuario]) => {
      if (!usuario) return [];
      return tareas.filter(t => t.valoracionesPendientes?.includes(usuario.uid));
    })
  );

  onAsignadoCambio(tarea: TareaDTO, nuevoUid: string) {
    const enCurso = this.esEnCurso(tarea);
    const soyAsignado = tarea.asignadA === this.usuarioActual?.uid;

    if (enCurso && !soyAsignado) {
      this.snackBar.open('⛔ Solo quien la tiene en curso puede reasignar.', 'Cerrar', { duration: 3000 });
      return;
    }

    this.reasignarTarea(tarea.id!, nuevoUid);
  }

  onPenalizarAbandono(ev: { tareaId: string; uid: string; puntos: number }) {
    this.snackBar.open(`-${Math.abs(ev.puntos)} puntos por abandonar la tarea`, 'Cerrar', { duration: 3000 });
  }

  onTareaCompletada(tarea: TareaDTO) {
    this.finalizarTarea(tarea);
  }

  abrirCrearHogar() {
    const ref = this.dialog.open(DialogCrearHogarComponent, {
      disableClose: true,
      width: '540px',
      maxWidth: '92vw',
      panelClass: 'crear-hogar-dialog',
    });

    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result?: { nombre: string; provincia: string }) => {
      if (!result) return;
      const { nombre, provincia } = result;
      if (!nombre?.trim() || !provincia) return;

      const user = this.fbAuth.currentUser;
      if (!user) return;

      this.hogar.crearHogar(nombre.trim(), provincia, user).catch(err => {
        console.error('Error creando hogar:', err);
        this.snackBar.open('❌ Error al crear el hogar', 'Cerrar', { duration: 3000 });
      });
    });
  }

  abrirUnirseHogar() {
    this.dialog.open(DialogUnirseCodigo, {
      width: '500px',
      maxWidth: '92vw',
      panelClass: 'unirse-dialog',
      disableClose: true
    });
  }

  probarDemo() {
    this.snackBar.open('Entrando en modo demo…', '', { duration: 1500 });
    this.auth.logout?.();
  }

  // --------------------------
  // DEMO
  // --------------------------
  private asignarDemoEnCaliente(
    tareas: TareaDTO[],
    miembros: { uid: string; nombre: string; fotoURL?: string }[]
  ): TareaDTO[] {
    if (!miembros.length) {
      return tareas.map(t => ({
        ...t,
        asignadA: null,
        asignadoNombre: '',
        asignadoFotoURL: ''
      }));
    }

    const esBloqueada = (t: TareaDTO) => !!t.bloqueadaHastaValoracion;
    const preservar = (t: TareaDTO) => esBloqueada(t);

    const patron = ['A', 'U', 'A', 'A'] as const;

    let idxMiembro = 0;

    return tareas.map((t, i) => {
      if (preservar(t)) return t;

      const paso = patron[i % patron.length];

      if (paso === 'U') {
        return {
          ...t,
          asignadA: null,
          asignadoNombre: '',
          asignadoFotoURL: ''
        };
      }

      const m = miembros[idxMiembro % miembros.length];
      idxMiembro++;

      return {
        ...t,
        asignadA: m.uid,
        asignadoNombre: m.nombre,
        asignadoFotoURL: m.fotoURL ?? ''
      };
    });
  }
}
