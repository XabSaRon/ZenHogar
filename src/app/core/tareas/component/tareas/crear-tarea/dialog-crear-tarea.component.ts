import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core'; //

type CrearTareaPayload = {
  nombre: string;
  descripcion?: string;
};

@Component({
  selector: 'app-dialog-crear-tarea',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatOptionModule
  ],
  templateUrl: './dialog-crear-tarea.component.html',
  styleUrls: ['./dialog-crear-tarea.component.scss'],
})
export class DialogCrearTareaComponent {
  private dialogRef = inject(MatDialogRef<DialogCrearTareaComponent, CrearTareaPayload | undefined>);

  creando = signal(false);

  form = new FormGroup({
    nombre: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(60)],
    }),
    descripcion: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(240)],
    }),
    peso: new FormControl<number>(1, {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  get nombreCtrl() { return this.form.controls.nombre; }
  get descripcionCtrl() { return this.form.controls.descripcion; }

  onCancelar() {
    if (this.creando()) return;
    this.dialogRef.close(undefined);
  }

  onCrear() {
    const nombre = (this.nombreCtrl.value || '').trim();
    const descripcion = (this.descripcionCtrl.value || '').trim();
    const peso = this.form.controls.peso.value;

    this.nombreCtrl.setValue(nombre);
    this.descripcionCtrl.setValue(descripcion);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.creando.set(true);

    setTimeout(() => {
      this.dialogRef.close({
        nombre,
        descripcion: descripcion || undefined,
        peso,
      });
    }, 0);
  }

  onKeydownEnter(event: KeyboardEvent) {
    if (!this.creando() && this.form.valid) {
      event.preventDefault();
      this.onCrear();
    }
  }
}
