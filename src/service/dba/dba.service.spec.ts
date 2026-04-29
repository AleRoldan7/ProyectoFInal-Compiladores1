import { TestBed } from '@angular/core/testing';

import { DbaService } from './dba.service';

describe('DbaService', () => {
  let service: DbaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DbaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
