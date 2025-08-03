import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogValorarTarea } from './dialog-valorar-tarea';

describe('DialogValorarTarea', () => {
  let component: DialogValorarTarea;
  let fixture: ComponentFixture<DialogValorarTarea>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogValorarTarea]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DialogValorarTarea);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
