import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DatePipe } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-historial-dialog',
  standalone: true,
  templateUrl: './historial-dialog.component.html',
  styleUrls: ['./historial-dialog.component.scss'],
  imports: [
    MatDialogModule,
    DatePipe,
    MatIconModule
  ]
})
export class HistorialDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) { }

  onImageError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-avatar.png';
  }
}

