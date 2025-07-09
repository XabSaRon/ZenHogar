import { Component, inject } from '@angular/core';
import { CommonModule, NgFor, NgIf, AsyncPipe } from '@angular/common';
import { combineLatest, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { AuthService } from '../auth/auth.service';
import { HogarService } from '../hogar/hogar.service';
import { TareasService } from './tareas.service';
import { TareaDTO } from './tarea.model';
import { TarjetaTareaComponent } from './tarjeta-tarea.component';

@Component({
  selector: 'app-lista-tareas',
  standalone: true,
  imports: [CommonModule, AsyncPipe, TarjetaTareaComponent],
  templateUrl: './lista-tareas.component.html',
  styleUrls: ['./lista-tareas.component.scss']
})
export class ListaTareasComponent {
  private auth = inject(AuthService);
  private hogar = inject(HogarService);
  private tareas = inject(TareasService);

  usuario$ = this.auth.user$;

  tareas$ = combineLatest([this.usuario$, this.hogar.getHogar$()]).pipe(
    switchMap(([usuario, hogar]) => {
      if (!hogar) return of([] as TareaDTO[]);
      return this.tareas.getTareasPorHogar(hogar.id!);
    })
  );
}
