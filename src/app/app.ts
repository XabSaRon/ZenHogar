import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TarjetaTareaComponent } from './shared/tarjeta-tarea/tarjeta-tarea.component';
import { TareasService } from './core/tareas.service';
import { Observable } from 'rxjs';
import { Tarea } from './core/tarea.model';
import { AsyncPipe, NgIf, NgFor } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TarjetaTareaComponent, AsyncPipe, NgIf, NgFor],
  templateUrl: './app.html',
})
export class App {
  protected title = 'zenhogar';

  private tareasService = inject(TareasService);

  tareas$: Observable<Tarea[]> = this.tareasService.obtenerTareas();
}
