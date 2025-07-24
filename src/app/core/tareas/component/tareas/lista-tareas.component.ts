import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest, of } from 'rxjs';
import { switchMap, map, filter } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';

import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
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
  }

  reasignarTarea(tareaId: string | undefined, nuevoUid: string) {
    if (!tareaId) return;

    this.tareas.asignarTarea(tareaId, nuevoUid).catch((err) => {
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

    try {
      await updateDoc(tareaRef, {
        completada: true,
        historial: [...(tarea.historial || []), historialItem],
        asignadA: null,
        asignadoNombre: null,
        asignadoFotoURL: null,
      });

      this.snackBar.open('✅ Tarea completada', 'Cerrar', { duration: 3000 });
    } catch {
      this.snackBar.open('❌ Error al marcar como completada', 'Cerrar', { duration: 3000 });
    }
  }
}
