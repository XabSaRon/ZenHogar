import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-tarjeta-tarea',
  standalone: true,
  templateUrl: './tarjeta-tarea.component.html',
  styleUrls: ['./tarjeta-tarea.component.scss'],
})
export class TarjetaTareaComponent {
  @Input() titulo = '';
  @Input() asignadoNombre?: string;
}

