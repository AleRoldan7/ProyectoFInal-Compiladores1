import { TestBed } from '@angular/core/testing';

import { PestanasService } from './pestanas.service';

describe('PestanasService', () => {
  let service: PestanasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PestanasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
