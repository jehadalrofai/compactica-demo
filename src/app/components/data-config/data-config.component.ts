import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { OsrmService } from '../../services/osrm.service';
import { GpsRouteDataService } from '../../services/gps-route-data.service';
import { OsrmResponse } from '../../models/osrm-response.model';
import { toInteger } from 'lodash';

@Component({
  selector: 'app-data-config',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './data-config.component.html',
  styleUrls: ['./data-config.component.scss'],
})
export class DataConfigComponent {
  routeForm: FormGroup;
  showGpsSensorId: boolean = true;
  showAccelerometerSensorId: boolean = false;
  showDuration: boolean = false;

  constructor(
    private fb: FormBuilder, 
    private osrmService: OsrmService, 
    private gpsRouteDataService: GpsRouteDataService, 
    private toastr: ToastrService
  ) {
    this.routeForm = this.fb.group({
      dataSource: [1, Validators.required], // Default to GPS only
      gpsSensorId: [''],
      accelerometerSensorId: [''],
      startPoint: [''],
      destination: [''],
      isAutoSync: [false],
      duration:[0, Validators.required],
    });

    // Initialize visibility based on the initial value
    this.updateVisibility(this.routeForm.get('dataSource')?.value);
  }
  
  onDataSourceChange(): void {
    const dataSourceValue = this.routeForm.get('dataSource')?.value;
    this.updateVisibility(+dataSourceValue);
  }

  private updateVisibility(dataSourceValue: number): void {
    // Set visibility based on the selected data source
    this.showGpsSensorId = dataSourceValue === 1 || dataSourceValue === 3;
    this.showAccelerometerSensorId = dataSourceValue === 2 || dataSourceValue === 3;
    this.showDuration = dataSourceValue === 2
    // Set or clear validators based on the data source selection
    if (this.showGpsSensorId) {
      this.routeForm.get('gpsSensorId')?.setValidators(Validators.required);
      this.routeForm.get('startPoint')?.setValidators(Validators.required);
      this.routeForm.get('destination')?.setValidators(Validators.required);
    } else {
      this.routeForm.get('gpsSensorId')?.clearValidators();
      this.routeForm.get('startPoint')?.clearValidators();
      this.routeForm.get('destination')?.clearValidators();
    }

    if (this.showAccelerometerSensorId) {
      this.routeForm.get('accelerometerSensorId')?.setValidators(Validators.required);
    } else {
      this.routeForm.get('accelerometerSensorId')?.clearValidators();
    }

    if (this.showDuration) {
      this.routeForm.get('duration')?.setValidators(Validators.required);
    } else {
      this.routeForm.get('duration')?.clearValidators();
    }


    // Update form control validity
    this.routeForm.get('gpsSensorId')?.updateValueAndValidity();
    this.routeForm.get('startPoint')?.updateValueAndValidity();
    this.routeForm.get('destination')?.updateValueAndValidity();
    this.routeForm.get('accelerometerSensorId')?.updateValueAndValidity();
    this.routeForm.get('duration')?.updateValueAndValidity();
  }

  coordinateValidator(control: any) {
    const value = control.value || '';
    const regex = /^\s*[-+]?(\d+(\.\d+)?),\s*[-+]?(\d+(\.\d+)?)/;
    return regex.test(value) ? null : { invalidCoordinate: true };
  }

  parseCoordinates(value: string): { lat: number; lon: number } {
    const [lat, lon] = value.split(',').map(coord => parseFloat(coord.trim()));
    return { lat, lon };
  }

  onSubmit() {
    const formValues = this.routeForm.value;
    const dataSource = formValues.dataSource;
    const gpsSensorId = formValues.gpsSensorId ?? '';
    const accelerometerSensorId = formValues.accelerometerSensorId ?? '';
    const duration = dataSource === 2 ? formValues.duration: 0;
    
    const isInProgress = this.gpsRouteDataService.getRouteInProgressValue();
    if (isInProgress) {
      this.toastr.error('A route is already in progress. Please wait for it to finish or reset it before starting a new one.', 'Error');
      return;
    }
    
    if (this.routeForm.valid) {
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
                this.gpsRouteDataService.updateRouteData(dataSource, gpsSensorId, accelerometerSensorId, duration, startPoint, destination, coordinates);
                this.toastr.success(`Location is valid! Distance: ${(distance / 1000).toFixed(2)} km`, 'Success');
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
        // Handle case when only accelerometer is selected
        this.gpsRouteDataService.updateRouteData(dataSource, gpsSensorId, accelerometerSensorId, duration);
        this.toastr.info('Accelerometer data source selected without GPS routing.', 'Info');
      }
    }
  }
}
