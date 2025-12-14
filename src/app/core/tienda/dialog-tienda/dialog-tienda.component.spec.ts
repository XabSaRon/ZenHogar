import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogTiendaComponent } from './dialog-tienda.component';

describe('DialogTiendaComponent', () => {
  let component: DialogTiendaComponent;
  let fixture: ComponentFixture<DialogTiendaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogTiendaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DialogTiendaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
