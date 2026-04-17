import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PagePrincipal } from './page-principal';

describe('PagePrincipal', () => {
  let component: PagePrincipal;
  let fixture: ComponentFixture<PagePrincipal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PagePrincipal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PagePrincipal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
