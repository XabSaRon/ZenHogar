import { TestBed } from '@angular/core/testing';
import { TareasService } from './tareas/tareas.service';

describe('Tareas', () => {
  let service: TareasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TareasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
