import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogCrearHogarComponent } from './dialog-crear-hogar';

describe('DialogCrearHogar', () => {
  let component: DialogCrearHogarComponent;
  let fixture: ComponentFixture<DialogCrearHogarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogCrearHogarComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(DialogCrearHogarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

