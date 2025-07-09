import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TareaDTO } from './tarea.model';

@Component({
  selector: 'app-tarjeta-tarea',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tarjeta-tarea.component.html',
  styleUrls: ['./tarjeta-tarea.component.scss'],
})
export class TarjetaTareaComponent {
  @Input() tarea!: TareaDTO;
  @Input() uidActual = '';

  onImageError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-avatar.png';
  }

  get emoji(): string {
    const nombre = this.tarea.nombre.toLowerCase();

    if (nombre.includes('barrer')) return '🧹';
    if (nombre.includes('fregar')) return '🧼';
    if (nombre.includes('cocinar') || nombre.includes('comida')) return '🍳';
    if (nombre.includes('ropa') || nombre.includes('lavar')) return '👕';
    if (nombre.includes('baño') || nombre.includes('wc')) return '🚽';
    if (nombre.includes('sacar basura') || nombre.includes('basura')) return '🗑️';
    if (nombre.includes('limpiar')) return '🧽';
    if (nombre.includes('hacer la cama')) return '🛏️';
    return '🏠';
  }

}

