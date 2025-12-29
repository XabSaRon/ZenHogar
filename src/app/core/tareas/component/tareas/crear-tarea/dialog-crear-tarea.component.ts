import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';

type TareaFormPayload = {
  nombre: string;
  descripcion?: string;
  peso: number;
};

type DialogCrearTareaData = {
  modo?: 'crear' | 'editar';
  tarea?: {
    nombre: string;
    descripcion?: string;
    peso?: number;
  };
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
  private dialogRef = inject(MatDialogRef<DialogCrearTareaComponent, TareaFormPayload | undefined>);
  private data = inject<DialogCrearTareaData | null>(MAT_DIALOG_DATA, { optional: true });

  creando = signal(false);

  readonly isEdit = (this.data?.modo ?? 'crear') === 'editar';
  readonly titulo = this.isEdit ? 'Editar tarea' : 'Nueva tarea';
  readonly icono = this.isEdit ? 'edit' : 'add_task';
  readonly cta = this.isEdit ? 'Guardar' : 'Crear';

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

  constructor() {
    const t = this.data?.tarea;
    if (t) {
      this.form.patchValue({
        nombre: (t.nombre ?? '').trim(),
        descripcion: (t.descripcion ?? '').trim(),
        peso: t.peso ?? 1,
      });
    }
  }

  get nombreCtrl() { return this.form.controls.nombre; }
  get descripcionCtrl() { return this.form.controls.descripcion; }

  onCancelar() {
    if (this.creando()) return;
    this.dialogRef.close(undefined);
  }

  onSubmit() {
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
}
