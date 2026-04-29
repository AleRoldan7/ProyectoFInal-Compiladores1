import { TestBed } from '@angular/core/testing';

import { CodigoCompiladoService } from './codigo-compilado.service';

describe('CodigoCompiladoService', () => {
  let service: CodigoCompiladoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CodigoCompiladoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
