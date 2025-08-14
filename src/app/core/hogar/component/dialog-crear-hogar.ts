import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

@Component({
  selector: 'app-dialog-crear-hogar',
  standalone: true,
  templateUrl: './dialog-crear-hogar.html',
  styleUrls: ['./dialog-crear-hogar.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatOptionModule,
    MatAutocompleteModule
  ],
})
export class DialogCrearHogarComponent {
  nombre = '';
  provincia = '';
  filtroProvincia = '';
  provinciaInput = '';

  provincias: string[] = [
    'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila',
    'Badajoz', 'Barcelona', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria',
    'Castellón', 'Ciudad Real', 'Córdoba', 'Cuenca', 'Gipuzkoa', 'Girona',
    'Granada', 'Guadalajara', 'Huelva', 'Huesca', 'Illes Balears', 'Jaén',
    'A Coruña', 'La Rioja', 'Las Palmas', 'León', 'Lleida', 'Lugo',
    'Madrid', 'Málaga', 'Murcia', 'Navarra', 'Ourense', 'Palencia',
    'Pontevedra', 'Salamanca', 'Santa Cruz de Tenerife', 'Segovia', 'Sevilla',
    'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid',
    'Bizkaia', 'Zamora', 'Zaragoza'
  ];

  private ref = inject(MatDialogRef<DialogCrearHogarComponent>);

  crear(): void {
    const limpio = this.nombre.trim();
    if (!limpio || !this.provincia) return;
    this.ref.close({ nombre: limpio, provincia: this.provincia });
  }

  cancelar(): void {
    this.ref.close(null);
  }

  onOpenChange(open: boolean) {
    if (!open) return;
    setTimeout(() => {
      const el = document.querySelector('.panel-provincias .search-option input[matinput]') as HTMLInputElement | null;
      el?.focus();
    }, 0);
  }

  get provinciasFiltradas(): string[] {
    const s = (this.provinciaInput || '').trim().toLowerCase();
    if (!s) return this.provincias;
    return this.provincias.filter(p => p.toLowerCase().includes(s));
  }

  onProvinciaInputChange(value: string) {
    this.provinciaInput = value ?? '';
    if (!this.provinciaInput) this.provincia = '';
  }

  onProvinciaSelected(value: string) {
    this.provincia = value;
    this.provinciaInput = value;
  }
}

