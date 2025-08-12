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

import { User } from '@angular/fire/auth';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

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
  private usuarioSeleccionado$ = new BehaviorSubject<string | null>(null);
  private destroyRef = di(DestroyRef);

  @ViewChild('dropdown') dropdown?: ElementRef<HTMLElement>;
  @ViewChild('trigger') trigger?: ElementRef<HTMLElement>;

  usuario$ = this.auth.user$;
  usuarioActual: User | null = null;
  uidSeleccionado: string | null = null;
  mostrarFiltro = false;
  uidSeleccionadoNombre: string | null = null;
  uidSeleccionadoFoto: string | null = null;

  miembros: { uid: string; nombre: string; fotoURL?: string }[] = [];

  isGuest$ = this.usuario$.pipe(map(u => !u));

  tareas$ = combineLatest([this.usuario$, this.usuarioSeleccionado$]).pipe(
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
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    if (!this.mostrarFiltro) return;
    const target = ev.target as Node;
    const insideDropdown = this.dropdown?.nativeElement.contains(target) ?? false;
    const insideTrigger = this.trigger?.nativeElement.contains(target) ?? false;
    if (!insideDropdown && !insideTrigger) {
      this.mostrarFiltro = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.mostrarFiltro = false;
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

  loginConGoogle() {
    this.auth.loginGoogle();
  }

  invitaALogin() {
    this.snackBar.open('🔒 Inicia sesión para asignar y valorar tareas.', 'Iniciar sesión', { duration: 4000 })
      .onAction().subscribe(() => this.loginConGoogle());
  }

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

  tareasParaValorar$ = combineLatest([this.tareas$, this.usuario$]).pipe(
    map(([tareas, usuario]) => {
      if (!usuario) return [];
      return tareas.filter(t =>
        t.valoracionesPendientes?.includes(usuario.uid)
      );
    })
  );

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

    let idxAsign = 0;
    return tareas.map((t, i) => {
      if (i === 1) {
        return { ...t, asignadA: null, asignadoNombre: '', asignadoFotoURL: '' };
      }

      const seAsigna = i % 3 !== 2;
      if (seAsigna) {
        const m = miembros[idxAsign % miembros.length];
        idxAsign++;
        return {
          ...t,
          asignadA: m.uid,
          asignadoNombre: m.nombre,
          asignadoFotoURL: m.fotoURL ?? ''
        };
      }
      return { ...t, asignadA: null, asignadoNombre: '', asignadoFotoURL: '' };
    });
  }

}
