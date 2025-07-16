import { Component, inject } from '@angular/core';
import { CommonModule, NgFor, NgIf, AsyncPipe } from '@angular/common';
import { combineLatest, of } from 'rxjs';
import { switchMap, map, filter } from 'rxjs/operators';

import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  doc,
  docData,
  DocumentData
} from '@angular/fire/firestore';

import { AuthService } from '../auth/auth.service';
import { HogarService } from '../hogar/hogar.service';
import { TareasService } from './tareas.service';
import { TareaDTO } from './tarea.model';
import { TarjetaTareaComponent } from './tarjeta-tarea.component';
import { Usuario } from '../usuarios/usuario.model';

@Component({
  selector: 'app-lista-tareas',
  standalone: true,
  imports: [CommonModule, AsyncPipe, TarjetaTareaComponent],
  templateUrl: './lista-tareas.component.html',
  styleUrls: ['./lista-tareas.component.scss'],
})
export class ListaTareasComponent {
  private auth = inject(AuthService);
  private hogar = inject(HogarService);
  private tareas = inject(TareasService);
  private fs = inject(Firestore);

  usuario$ = this.auth.user$;

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

  reasignarTarea(tareaId: string | undefined, nuevoUid: string) {
    if (!tareaId) return;

    this.tareas.asignarTarea(tareaId, nuevoUid).catch((err) => {
      console.error('Error al asignar tarea', err);
    });
  }
}

