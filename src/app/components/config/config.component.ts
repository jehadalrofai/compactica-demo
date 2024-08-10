import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { OsrmService } from '../../services/osrm.service';
import { DataConfigService } from '../../services/data-config.service';
import { OsrmResponse } from '../../models/osrm-response.model';
import { Subscription } from 'rxjs';
import { RouteData } from '../../models/route-data.model';

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
    // Initialize the form with default values and validators
    this.configForm = this.fb.group({
      dataSource: [1, Validators.required],
      gpsSensorId: [''],
      accelerometerSensorId: [''],
      startPoint: [''],
      destination: [''],
      isAutoSync: [false],
    });
    
    // Set visibility of form fields based on the data source value
    this.updateVisibility(this.configForm.get('dataSource')?.value);
  }

  /**
   * Lifecycle hook that is called after Angular has initialized all data-bound properties.
   * Sets up subscriptions to observe changes in the form's state and other relevant observables.
   */
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
          this.configForm.reset({
            dataSource: 1,
            gpsSensorId: '',
            accelerometerSensorId: '',
            startPoint: '',
            destination: '',
            isAutoSync: false,
          });
        }
      })
    );
  }

  /**
   * Lifecycle hook that is called when the component is destroyed.
   * Cleans up any subscriptions to prevent memory leaks.
   */
  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  /**
   * Handles changes to the data source selection and updates the visibility of relevant form fields.
   */
  public onDataSourceChange(): void {
    const dataSourceValue = this.configForm.get('dataSource')?.value;
    this.updateVisibility(+dataSourceValue);
  }

  /**
   * Handles form submission. Validates the form and triggers route generation or simulation
   * based on the selected data source.
   */
  public onSubmit(): void {
    if (this.configForm.disabled) return;

    const formValues = this.configForm.value;
    const dataSource = +formValues.dataSource;
    const gpsSensorId = formValues.gpsSensorId ?? '';
    const accelerometerSensorId = formValues.accelerometerSensorId ?? '';
    const isAutoSync = formValues.isAutoSync;

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
                const routeData: RouteData = {
                  dataSource: dataSource,
                  isAutoSync: isAutoSync,
                  gpsSensorId: gpsSensorId,
                  accelerometerSensorId: accelerometerSensorId,
                  start: startPoint,
                  destination: destination,
                  coordinates: coordinates
                };
                this.dataConfigService.updateRouteData(routeData);
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
        const routeData: RouteData = {
          dataSource: dataSource,
          isAutoSync: isAutoSync,
          gpsSensorId: gpsSensorId,
          accelerometerSensorId: accelerometerSensorId,
        };

        this.dataConfigService.updateRouteData(routeData);

        this.toastr.success(`Accelerometer data source selected, random readings will be generated.`, 'Info');
        this.dataConfigService.updateIsActive(true);
        this.setActiveTab.emit('live-data');
      }
    }
  }

  /**
   * Parses a coordinate string and returns an object containing latitude and longitude.
   * 
   * @param value - A string containing the latitude and longitude separated by a comma.
   * @returns An object containing the latitude and longitude as numbers.
   */
  private parseCoordinates(value: string): { lat: number; lon: number } {
    const [lat, lon] = value.split(',').map(coord => parseFloat(coord.trim()));
    return { lat, lon };
  }

  /**
   * Enables or disables the form based on the given boolean value.
   * 
   * @param disable - A boolean indicating whether to disable the form.
   */
  private toggleFormState(disable: boolean): void {
    if (disable) {
      this.configForm.disable();
    } else {
      this.configForm.enable();
    }
  }

  /**
   * Updates the visibility of form fields based on the selected data source.
   * 
   * @param dataSourceValue - The selected data source value.
   */
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