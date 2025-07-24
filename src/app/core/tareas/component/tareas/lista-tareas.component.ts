import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest, of } from 'rxjs';
import { switchMap, map, filter } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';

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

import { User } from '@angular/fire/auth';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-lista-tareas',
  standalone: true,
  imports: [CommonModule, AsyncPipe, TarjetaTareaComponent],
  templateUrl: './lista-tareas.component.html',
  styleUrls: ['./lista-tareas.component.scss'],
})
export class ListaTareasComponent implements OnInit {
  private auth = inject(AuthService);
  private hogar = inject(HogarService);
  private tareas = inject(TareasService);
  private fs = inject(Firestore);
  private snackBar = inject(MatSnackBar);

  usuario$ = this.auth.user$;
  usuarioActual: User | null = null;

  miembros: { uid: string; nombre: string; fotoURL?: string }[] = [];

  tareas$ = combineLatest([this.usuario$, this.hogar.getHogar$()]).pipe(
    switchMap(([usuario, hogar]) => {
      if (!hogar) return of([] as TareaDTO[]);
      return this.tareas.getTareasPorHogar(hogar.id!);
    })
  );

  miembros$ = this.hogar.getHogar$().pipe(
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

  ngOnInit(): void {
    this.usuario$.subscribe(usuario => {
      this.usuarioActual = usuario;
    });

    this.miembros$.subscribe(lista => {
      this.miembros = lista;
    });
  }

  reasignarTarea(tareaId: string | undefined, nuevoUid: string) {
    if (!tareaId) return;

    this.tareas.asignarTarea(tareaId, nuevoUid).catch((err) => {
      const msg =
        err?.message === 'No se puede asignar esta tarea hasta que se complete la valoración.'
          ? '❌ No se puede asignar esta tarea hasta que todos valoren cómo se ha hecho.'
          : '❌ Error al asignar tarea';

      this.snackBar.open(msg, 'Cerrar', { duration: 3000 });
      console.error('Error al asignar tarea', err);
    });
  }

  async finalizarTarea(tarea: TareaDTO) {
    if (!this.usuarioActual) return;

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
}
