import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TarjetaTareaComponent } from '../tarjeta-tarea/tarjeta-tarea.component';

describe('TarjetaTarea', () => {
  let component: TarjetaTareaComponent;
  let fixture: ComponentFixture<TarjetaTareaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TarjetaTareaComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TarjetaTareaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
