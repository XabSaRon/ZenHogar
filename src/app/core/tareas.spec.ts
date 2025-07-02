import { TestBed } from '@angular/core/testing';

import { Tareas } from './tareas.service';

describe('Tareas', () => {
  let service: Tareas;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Tareas);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
