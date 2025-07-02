import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TarjetaTareaComponent } from './shared/tarjeta-tarea/tarjeta-tarea.component';
import { TareasService } from './core/tareas.service';
import { AuthService } from './core/auth.service';
import { Observable } from 'rxjs';
import { Tarea } from './core/tarea.model';
import { AsyncPipe, NgIf, NgFor } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    TarjetaTareaComponent,
    AsyncPipe,
    NgIf,
    NgFor,
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App {
  protected title = 'zenhogar';

  /** Servicios */
  tareasSvc = inject(TareasService);
  auth = inject(AuthService);

  /** Datos */
  tareas$: Observable<Tarea[]> = this.tareasSvc.obtenerTareas();
  user$ = this.auth.user$;           // ← observable de usuario
}

