import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DataTrackerComponent } from './data-tracker.component';

describe('GpsRouteTrackerComponent', () => {
  let component: DataTrackerComponent;
  let fixture: ComponentFixture<DataTrackerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataTrackerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DataTrackerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
