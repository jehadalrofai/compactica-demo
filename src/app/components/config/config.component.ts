import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { OsrmService } from '../../services/osrm.service';
import { DataConfigService } from '../../services/data-config.service';
import { OsrmResponse } from '../../models/osrm-response.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './config.component.html',
  styleUrls: ['./config.component.scss'],
})
export class ConfigComponent implements OnInit, OnDestroy {
  @Output() 
  private setActiveTab = new EventEmitter<string>();
  public isActive: boolean = false;
  public configForm: FormGroup;
  public showAccelerometerSensorId: boolean = false;
  public showDuration: boolean = false;
  public showGpsSensorId: boolean = true;

  private subscriptions: Subscription = new Subscription();

  constructor(
    private dataConfigService: DataConfigService,
    private fb: FormBuilder,
    private osrmService: OsrmService,
    private toastr: ToastrService
  ) {
    this.configForm = this.fb.group({
      dataSource: [1, Validators.required], // Default to GPS only
      gpsSensorId: [''],
      accelerometerSensorId: [''],
      startPoint: [''],
      destination: [''],
      isAutoSync: [false],
      duration: [0, Validators.required],
    });

    this.updateVisibility(this.configForm.get('dataSource')?.value);
  }

  ngOnInit() {
    this.subscriptions.add(
      this.dataConfigService.isActive.subscribe((isActive) => {
        this.isActive = isActive;
        this.toggleFormState(isActive);
      })
    );
    this.subscriptions.add(
      this.dataConfigService.clearForm.subscribe((clear) => {
        if (clear) {
          this.configForm.reset(); // Clear the form
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  public onDataSourceChange(): void {
    const dataSourceValue = this.configForm.get('dataSource')?.value;
    this.updateVisibility(+dataSourceValue);
  }

  public onSubmit(): void {
    if (this.configForm.disabled) return;

    const formValues = this.configForm.value;
    const dataSource = +formValues.dataSource;
    const gpsSensorId = formValues.gpsSensorId ?? '';
    const accelerometerSensorId = formValues.accelerometerSensorId ?? '';
    const duration = dataSource === 2 ? formValues.duration : 0;

    if (this.isActive) {
      this.toastr.error('A route is already in progress. Please wait for it to finish or reset it before starting a new one.', 'Error');
      return;
    }

    if (this.configForm.valid) {
      if (dataSource === 1 || dataSource === 3) {
        const startPoint = this.parseCoordinates(formValues.startPoint);
        const destination = this.parseCoordinates(formValues.destination);

        this.osrmService.getRoute(startPoint, destination).subscribe(
          (response: OsrmResponse) => {
            if (response.code === 'Ok' && response.routes && response.routes.length > 0) {
              const route = response.routes[0];
              const distance = route.distance;

              if (distance <= 3000) {
                const coordinates = response.routes[0].geometry.coordinates;
                this.dataConfigService.updateRouteData(dataSource, gpsSensorId, accelerometerSensorId, duration, startPoint, destination, coordinates);
                this.toastr.success(`Location is valid! Distance: ${(distance / 1000).toFixed(2)} km`, 'Success');
                this.dataConfigService.updateIsActive(true);
                this.setActiveTab.emit('live-data');
              } else {
                this.toastr.warning(`Distance is too far: ${(distance / 1000).toFixed(2)} km. Distance should be less than 3 km`, 'Warning');
              }
            } else {
              this.toastr.error('No valid route found. Please check your coordinates.', 'Error');
            }
          },
          error => {
            this.toastr.error('Location validation failed. Please check your coordinates and try again.', 'Error');
          }
        );
      } else {
        this.dataConfigService.updateRouteData(dataSource, gpsSensorId, accelerometerSensorId, duration);
        this.toastr.success(`Accelerometer data source selected, random readings will be generated for ${duration} seconds`, 'Info');
        this.dataConfigService.updateIsActive(true);
        this.setActiveTab.emit('live-data');
      }
    }
  }

  private parseCoordinates(value: string): { lat: number; lon: number } {
    const [lat, lon] = value.split(',').map(coord => parseFloat(coord.trim()));
    return { lat, lon };
  }

  private toggleFormState(disable: boolean): void {
    if (disable) {
      this.configForm.disable();
    } else {
      this.configForm.enable();
    }
  }

  private updateVisibility(dataSourceValue: number): void {
    this.showGpsSensorId = dataSourceValue === 1 || dataSourceValue === 3;
    this.showAccelerometerSensorId = dataSourceValue === 2 || dataSourceValue === 3;
    this.showDuration = dataSourceValue === 2;

    if (this.showGpsSensorId) {
      this.configForm.get('gpsSensorId')?.setValidators(Validators.required);
      this.configForm.get('startPoint')?.setValidators(Validators.required);
      this.configForm.get('destination')?.setValidators(Validators.required);
    } else {
      this.configForm.get('gpsSensorId')?.clearValidators();
      this.configForm.get('startPoint')?.clearValidators();
      this.configForm.get('destination')?.clearValidators();
    }

    if (this.showAccelerometerSensorId) {
      this.configForm.get('accelerometerSensorId')?.setValidators(Validators.required);
    } else {
      this.configForm.get('accelerometerSensorId')?.clearValidators();
    }

    if (this.showDuration) {
      this.configForm.get('duration')?.setValidators(Validators.required);
    } else {
      this.configForm.get('duration')?.clearValidators();
    }

    this.configForm.get('gpsSensorId')?.updateValueAndValidity();
    this.configForm.get('startPoint')?.updateValueAndValidity();
    this.configForm.get('destination')?.updateValueAndValidity();
    this.configForm.get('accelerometerSensorId')?.updateValueAndValidity();
    this.configForm.get('duration')?.updateValueAndValidity();
  }
}