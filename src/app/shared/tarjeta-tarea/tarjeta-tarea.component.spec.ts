import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TarjetaTarea } from './tarjeta-tarea';

describe('TarjetaTarea', () => {
  let component: TarjetaTarea;
  let fixture: ComponentFixture<TarjetaTarea>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TarjetaTarea]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TarjetaTarea);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
