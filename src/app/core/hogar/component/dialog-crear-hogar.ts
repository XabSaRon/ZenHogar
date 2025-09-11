import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatOptionModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { PROVINCIAS_INE, type Provincia } from '../../../shared/constants/provincias';

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
    MatOptionModule,
    MatAutocompleteModule,
  ],
})
export class DialogCrearHogarComponent {
  nombre = '';
  provinciaInput = '';
  provincia = '';

  readonly provincias: readonly Provincia[] = PROVINCIAS_INE;

  private readonly collator = new Intl.Collator('es', {
    sensitivity: 'base',
    numeric: true,
  });

  private ref = inject(MatDialogRef<DialogCrearHogarComponent>);

  crear(): void {
    const limpio = this.nombre.trim();
    const prov = this.provincias.find(p =>
      this.equalsLoose(p.name, this.provincia || this.provinciaInput)
    );

    if (!limpio || !prov) return;

    this.ref.close({
      nombre: limpio,
      provincia: prov.name,
      provinciaCode: prov.code,
    });
  }

  cancelar(): void {
    this.ref.close(null);
  }

  get provinciasFiltradas(): readonly Provincia[] {
    const s = this.normalize(this.provinciaInput);

    const base = s
      ? this.provincias.filter(p => this.normalize(p.name).includes(s))
      : this.provincias;

    return [...base].sort((a, b) => this.collator.compare(a.name, b.name));
  }

  onProvinciaInputChange(value: string) {
    this.provinciaInput = value ?? '';
    if (!this.provinciaInput) this.provincia = '';
  }

  onProvinciaSelected(value: string) {
    this.provincia = value;
    this.provinciaInput = value;
  }

  onProvinciaEnter(ev: KeyboardEvent) {
    const prov = this.provincias.find(p => this.equalsLoose(p.name, this.provinciaInput));
    if (!prov) {
      ev.preventDefault();
      return;
    }
  }

  get provinciaValida(): boolean {
    return !!this.provincias.find(p => this.equalsLoose(p.name, this.provincia || this.provinciaInput));
  }

  private normalize(v: string) {
    return (v || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }

  private equalsLoose(a: string, b: string) {
    return this.normalize(a) === this.normalize(b);
  }
}
