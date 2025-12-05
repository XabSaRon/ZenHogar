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
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';

import type { TipoHogar } from '../../models/hogar.model';
import {
  SUBDIVISIONS,
  type Subdivisiones,
  type CountryCode,
  AVAILABLE_COUNTRIES,
  COUNTRY_NAMES,
  countryName,
  flagPath,
} from '../../../../shared/constants/subdivisiones';
import { detectCountryByNavigator } from '../../../../shared/utils/geo';

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
    MatSelectModule,
    MatMenuModule,
  ],
})
export class DialogCrearHogarComponent {
  nombre = '';
  provinciaInput = '';
  provincia = '';

  tiposHogar: TipoHogar[] = ['Familiar', 'Pareja', 'Amigos', 'Erasmus'];
  tipoHogar: TipoHogar | '' = '';

  countryCode: CountryCode = (() => {
    const raw = (detectCountryByNavigator() ?? 'ES').toUpperCase();
    return (raw in SUBDIVISIONS ? raw : 'ES') as CountryCode;
  })();

  paisesDisponibles: CountryCode[] = AVAILABLE_COUNTRIES;

  countryNames = COUNTRY_NAMES;
  countryName = countryName;
  flagPath = flagPath;

  private readonly collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
  private ref = inject(MatDialogRef<DialogCrearHogarComponent>);

  get listaActual(): readonly Subdivisiones[] {
    return SUBDIVISIONS[this.countryCode] ?? [];
  }

  crear(): void {
    const limpio = this.nombre.trim();
    if (!limpio) return;

    const entrada = (this.provincia || this.provinciaInput).trim();
    if (!entrada) return;
    if (!this.tipoHogar) return;

    if (this.listaActual.length) {
      const prov = this.listaActual.find(p => this.equalsLoose(p.name, entrada));
      if (!prov) return;
      this.ref.close({
        nombre: limpio,
        provincia: prov.name,
        provinciaCode: prov.code,
        countryCode: this.countryCode,
        tipoHogar: this.tipoHogar,
      });
      return;
    }

    this.ref.close({
      nombre: limpio,
      provincia: entrada,
      provinciaCode: '',
      countryCode: this.countryCode,
      tipoHogar: this.tipoHogar,
    });
  }

  cancelar(): void {
    this.ref.close(null);
  }

  get provinciasFiltradas(): readonly Subdivisiones[] {
    if (!this.listaActual.length) return [];
    const s = this.normalize(this.provinciaInput);
    const base = s
      ? this.listaActual.filter(p => this.normalize(p.name).includes(s))
      : this.listaActual;
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
    if (!this.listaActual.length) return;
    const prov = this.listaActual.find(p => this.equalsLoose(p.name, this.provinciaInput));
    if (!prov) ev.preventDefault();
  }

  seleccionarPais(code: CountryCode) {
    if (!SUBDIVISIONS[code]) return;
    this.countryCode = code;
    this.provincia = '';
    this.provinciaInput = '';
  }

  get provinciaValida(): boolean {
    if (!this.listaActual.length) {
      return !!(this.provincia || this.provinciaInput).trim();
    }
    return !!this.listaActual.find(p => this.equalsLoose(p.name, this.provincia || this.provinciaInput));
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
