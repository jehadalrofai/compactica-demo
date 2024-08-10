import { AfterViewInit, Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { Subscription, finalize, interval, take } from 'rxjs';
import * as L from 'leaflet';
import * as turf from '@turf/turf';

import { AccelerometerService } from '../../services/accelerometer.service';
import { AltitudeService } from '../../services/altitude.service';
import { DataConfigService } from '../../services/data-config.service';
import { GpsService } from '../../services/gps.service';
import { ServerTimeService } from '../../services/server-time.service';
import { AccelerometerData, AccelerometerReading } from '../../models/accelerometer-data.model';
import { GpsData, GpsReading } from '../../models/gps-data.model';
import { RouteData } from '../../models/route-data.model';
import { environment } from '../../../environments/environment'; 

interface CombinedReading {
  type: 'gps' | 'accelerometer';
  lat?: number;
  lng?: number;
  alt?: number;
  x?: number;
  y?: number;
  z?: number;
  dt: string;
  isSynced: boolean;
}

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-data-tracker',
  templateUrl: './data-tracker.component.html',
  styleUrls: ['./data-tracker.component.scss']
})
export class DataTrackerComponent implements AfterViewInit, OnDestroy {
  public combinedReadings: CombinedReading[] = [];
  public lastGpsReading?: CombinedReading;
  public lastAccelerometerReading?: CombinedReading;
  public coordinates: number[][] = [];
  public currentAccelerometerId: string = '';
  public currentGPSId: string = '';
  public currentServerTime: string = '';
  public disableSyncButton: boolean = true;
  public isAutoSync: boolean = false;
  public isCompleted: boolean = false;
  public isRunning: boolean = false;
  public selectedDataSource: number = 0;
  public startButtonText: string = 'Start';

  private currentIndex: number = 0;
  private intervalMs: number = environment.intervalMs ?? 2000;
  private map!: L.Map;
  private marker: L.Marker | null = null;
  private movementSubscription: Subscription | null = null;
  private numberOfAccelReadings: number = environment.numberOfAccelReadings ?? 10
  private subscriptions = new Subscription();
  private routeLayer!: L.LayerGroup;
  private routeMovingDistance: number = environment.routeMovingDistance ?? 50;
  private smallIcon: L.Icon = L.icon({
    iconUrl: '/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  private timeSubscription: Subscription | null = null;
  @Output() 
  private setActiveTab = new EventEmitter<string>();

  constructor(
    private accelerometerService: AccelerometerService,
    private altitudeService: AltitudeService,
    private dataConfigService: DataConfigService,
    private gpsService: GpsService,
    private serverTimeService: ServerTimeService,
    private toastr: ToastrService,
  ) {

    // Subscribe to route data changes
    this.subscriptions.add(
      this.dataConfigService.currentRouteData.subscribe((data: RouteData | null) => {
        if (data) {
          this.isAutoSync = data.isAutoSync;
          this.selectedDataSource = data.dataSource;
          this.currentGPSId = data.gpsSensorId;
          this.currentAccelerometerId = data.accelerometerSensorId;
          this.coordinates = data.coordinates || [];
        }
      })
    );

    // Subscribe to server time updates
    this.subscriptions.add(
      this.serverTimeService.getLocalClock().subscribe(time => {
				 
        this.currentServerTime = time?.toISOString() || '';
      })
    );
  }

  /**
   * Lifecycle hook that is called after Angular has fully initialized the component's view.
   * Initializes the map if the selected data source involves GPS data.
   */
  ngAfterViewInit(): void {
    if (this.selectedDataSource === 1 || this.selectedDataSource === 3) {
      this.initMap();
      if (this.coordinates.length > 0) {
        this.drawRoute(this.coordinates);
      }
    }
  }

  /**
   * Lifecycle hook that is called when the component is destroyed.
   * Cleans up any subscriptions to prevent memory leaks.
   */
  ngOnDestroy(): void {
    if (this.subscriptions) {
      this.subscriptions.unsubscribe();
    }
    if (this.timeSubscription) {
      this.timeSubscription.unsubscribe();
    }
    this.stopSimulation();
  }

  /**
   * Groups readings by their timestamp to display in a more organized manner.
   * @returns An array of grouped readings, sorted by timestamp in descending order.
   */
  getGroupedReadings() {
    const grouped = new Map<string, { gps?: CombinedReading; accelerometer?: CombinedReading }>();
  
    for (const reading of this.combinedReadings) {
      if (!grouped.has(reading.dt)) {
        grouped.set(reading.dt, {});
      }
      const group = grouped.get(reading.dt);
      if (reading.type === 'gps') {
        group!.gps = reading;
      } else if (reading.type === 'accelerometer') {
        group!.accelerometer = reading;
      }
    }
  
    return Array.from(grouped.values()).sort((a, b) => {
      const dtA = a.gps?.dt || a.accelerometer?.dt;
      const dtB = b.gps?.dt || b.accelerometer?.dt;
      return new Date(dtB!).getTime() - new Date(dtA!).getTime();
    });
  }
  
  /**
   * Repositions the map marker to the first coordinate in the list.
   */
  private repositionMarker(): void {
    if (this.coordinates.length > 0 && (this.selectedDataSource !== 2)) {
      const [initialLon, initialLat] = this.coordinates[0];
      if (this.marker) {
        this.marker.setLatLng([initialLat, initialLon]);
      } else {
        this.marker = L.marker([initialLat, initialLon], { icon: this.smallIcon }).addTo(this.map);
      }
      this.map.panTo([initialLat, initialLon]);
    }
  }

  /**
   * Resets the simulation, clearing the state and resetting the map.
   */
  public resetSimulation(): void {
    this.stopSimulation();
    this.resetState();
    this.repositionMarker();
    this.serverTimeService.stopLocalClock();
    this.dataConfigService.updateIsActive(false);
    this.dataConfigService.clearRouteData();
    this.setActiveTab.emit('configurations');
  }

  /**
   * Resets the internal state of the component, clearing readings and resetting the UI.
   */
  private resetState(): void {
    this.combinedReadings = [];
    this.currentIndex = 0;
    this.isRunning = false;
    this.isCompleted = false;
    this.startButtonText = 'Start';
  }

  /**
   * Starts the simulation based on the selected data source, either moving the map marker
   * or simulating accelerometer readings.
   */
  public startSimulation(): void {
    this.serverTimeService.syncLocalClock().subscribe(
      () => {
        this.isRunning = true;
        if ((this.selectedDataSource === 1 || this.selectedDataSource === 3) && this.coordinates.length > 0) {
          if (!this.marker && this.currentIndex < this.coordinates.length && (this.selectedDataSource === 1 || this.selectedDataSource === 3)) {
            const [lon, lat] = this.coordinates[this.currentIndex];
            this.marker = L.marker([lat, lon], { icon: this.smallIcon }).addTo(this.map);
          }
          this.simulateGPSMovement();
        } else if (this.selectedDataSource === 2) {
          this.simulateAccelerometerReadings();
        } else {
          this.toastr.error('Please set up a route using the Configurations Form and/or Accelerometer Sensor Id', 'Error');
        }
      },
      error => {
        this.isRunning = false;
        this.toastr.error('Failed to sync with server time. Cannot start simulation.', 'Error');
      }
    );
  }

  /**
   * Stops the ongoing simulation and pauses the marker movement or accelerometer readings.
   */
  public stopSimulation(): void {
    if (this.movementSubscription) {
      this.movementSubscription.unsubscribe();
      this.movementSubscription = null;
      this.startButtonText = 'Resume';
      this.isRunning = false;
    }
  }

  /**
   * Submits the collected data to the backend services, sending GPS and/or accelerometer data.
   */
  public submitData(): void {
    if (this.selectedDataSource === 1 || this.selectedDataSource === 3) {
      const gpsData: GpsData = {
        Data: this.combinedReadings.filter(reading => reading.type === 'gps') as GpsReading[],
        SensorId: this.currentGPSId
      };

      if (gpsData.Data.length > 0) {
        this.submitGPSData(gpsData);
      }
    }

    if (this.selectedDataSource === 2 || this.selectedDataSource === 3) {
      const accelerometerData: AccelerometerData = {
        Data: this.combinedReadings.filter(reading => reading.type === 'accelerometer') as AccelerometerReading[],
        SensorId: this.currentAccelerometerId,
      };

      if (accelerometerData.Data.length > 0) {
        this.submitAccelerometerData(accelerometerData);
      }
    }
  }

  /**
   * Adds a random accelerometer reading to the list of combined readings.
   * If auto-sync is enabled, it submits the data immediately.
   * 
   * @param currentTime - The current timestamp.
   */
  private addRandomAccelerometerReading(currentTime: string): void {
    const newReading: CombinedReading = {
      type: 'accelerometer',
      x: this.getRandomValue(-0.5, 0.5),
      y: this.getRandomValue(-0.5, 0.5),
      z: this.getRandomValue(-0.5, 0.5),
      dt: currentTime,
      isSynced: false,
    };

    this.combinedReadings.push(newReading);
    this.lastAccelerometerReading = newReading;
    if (this.isAutoSync) {
      const accelerometerData: AccelerometerData = {
        Data: [newReading as AccelerometerReading],
        SensorId: this.currentAccelerometerId,
      };
      this.submitAccelerometerData(accelerometerData);
    }
  }

  /**
   * Draws the route on the map based on the provided coordinates.
   * 
   * @param coordinates - An array of coordinates representing the route.
   */
  private drawRoute(coordinates: number[][]): void {
    this.routeLayer.clearLayers();

    const latlngs = coordinates.map(coord => [coord[1], coord[0]] as [number, number]);
    const polyline = L.polyline(latlngs, { color: 'blue' }).addTo(this.routeLayer);

    this.map.fitBounds(polyline.getBounds());
  }

  /**
   * Generates a random value within the specified range.
   * 
   * @param min - The minimum value.
   * @param max - The maximum value.
   * @returns A random number between min and max.
   */
  private getRandomValue(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * Calculates the Haversine distance between two geographic coordinates.
   * 
   * @param coord1 - The first coordinate.
   * @param coord2 - The second coordinate.
   * @returns The distance in meters between the two coordinates.
   */
  private haversineDistance(coord1: number[], coord2: number[]): number {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const lat1 = coord1[1];
    const lon1 = coord1[0];
    const lat2 = coord2[1];
    const lon2 = coord2[0];

    const R = 6371e3;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Initializes the map with a given center and zoom level.
   */
  private initMap(): void {
    this.map = L.map('map', {
      center: [39.8282, -98.5795],
      zoom: 3
    });

    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      minZoom: 3,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    tiles.addTo(this.map);
    this.routeLayer = L.layerGroup().addTo(this.map);
  }

  /**
   * Simulates accelerometer readings by generating random values at regular intervals.
   */
  private simulateAccelerometerReadings(): void {
    this.movementSubscription = interval(this.intervalMs)
      .pipe(
        take(this.numberOfAccelReadings), 
        finalize(() => {
          this.stopSimulation();

          this.isCompleted = true;
          if (!this.isAutoSync) {
            this.disableSyncButton = false;
          }
        })
      )
      .subscribe(() => {
        this.addRandomAccelerometerReading(this.currentServerTime);
    });
  }

  /**
   * Simulates GPS movement along a predefined route by moving the marker at regular intervals.
   */
  private simulateGPSMovement(): void {
    this.movementSubscription = interval(this.intervalMs).subscribe(() => {
      let remainingMoveDistance = this.routeMovingDistance;

      while (remainingMoveDistance > 0 && this.currentIndex < this.coordinates.length - 1) {
        const currentPoint = turf.point(this.coordinates[this.currentIndex]);
        const nextPoint = turf.point(this.coordinates[this.currentIndex + 1]);
        const segmentDistance = this.haversineDistance(this.coordinates[this.currentIndex], this.coordinates[this.currentIndex + 1]);

        if (segmentDistance <= remainingMoveDistance) {
          remainingMoveDistance -= segmentDistance;
          this.currentIndex++;

          if (this.currentIndex < this.coordinates.length - 1) {
            const [nextLon, nextLat] = this.coordinates[this.currentIndex];
            if (this.selectedDataSource === 1 || this.selectedDataSource === 3) {
              this.marker?.setLatLng([nextLat, nextLon]);
              this.map.panTo([nextLat, nextLon]);
            }
          }
        } else {
          const bearing = turf.bearing(currentPoint, nextPoint);
          const destination = turf.destination(currentPoint, remainingMoveDistance / 1000, bearing);
          const newLat = destination.geometry.coordinates[1];
          const newLon = destination.geometry.coordinates[0];

          if (this.selectedDataSource === 1 || this.selectedDataSource === 3) {
            this.marker?.setLatLng([newLat, newLon]);
            this.map.panTo([newLat, newLon]);
          }

          this.coordinates[this.currentIndex] = [newLon, newLat];
          remainingMoveDistance = 0;
        }
      }

      if (this.currentIndex >= this.coordinates.length - 1) {
        this.stopSimulation();

        this.isCompleted = true;
        if (!this.isAutoSync) {
          this.disableSyncButton = false;
        }
      } else {
        const currentPos = this.coordinates[this.currentIndex];
        const currentTime = this.currentServerTime;

        if (this.selectedDataSource === 1 || this.selectedDataSource === 3) {
          this.altitudeService.getAltitude(currentPos[1], currentPos[0]).subscribe(altitude => {
            const newPosition: CombinedReading = {
              type: 'gps',
              lat: currentPos[1],
              lng: currentPos[0],
              alt: altitude,
              isSynced: false,
              dt: currentTime,
            };
            this.combinedReadings.push(newPosition);
            this.lastGpsReading = newPosition;
            if (this.isAutoSync) {
              const gpsData: GpsData = {
                Data: [newPosition as GpsReading],
                SensorId: this.currentGPSId
              };
              this.submitGPSData(gpsData);
            }
          });
        }

        if (this.selectedDataSource === 3) {
          this.addRandomAccelerometerReading(currentTime);
        }
      }
    });
  }

  /**
   * Submits the accelerometer data to the backend service.
   * 
   * @param accelerometerData - The data to be submitted.
   */
  private submitAccelerometerData(accelerometerData: AccelerometerData): void {
    if (this.selectedDataSource === 2 || this.selectedDataSource === 3) {
      this.accelerometerService.sendAccelerometerData(accelerometerData).subscribe(
        response => {
          console.log('Accelerometer data sent successfully', response);
          this.updateSyncStatus('accelerometer', accelerometerData?.Data as CombinedReading[]);
        },
        error => {
          console.error('Failed to send accelerometer data', error);
          this.toastr.error('Failed to sync accelerometer reading.');
        }
      );
    }
  }

  /**
   * Submits the GPS data to the backend service.
   * 
   * @param gpsData - The data to be submitted.
   */
  private submitGPSData(gpsData: GpsData): void {
    if (this.selectedDataSource === 1 || this.selectedDataSource === 3) {
      this.gpsService.sendGpsData(gpsData).subscribe(
        response => {
          console.log('GPS data sent successfully', response);
          this.updateSyncStatus('gps', gpsData?.Data as CombinedReading[]);
        },
        error => {
          console.error('Failed to send GPS data', error);
          this.toastr.error('Failed to sync GPS reading.');
        }
      );
    }
  }
  
  /**
   * Updates the sync status of the readings after data submission.
   * 
   * @param type - The type of data being synced ('gps' or 'accelerometer').
   * @param readings - The readings to be updated.
   */
  private updateSyncStatus(type: 'gps' | 'accelerometer', readings: CombinedReading[]): void {
    if (this.isAutoSync) {
      const [firstReading] = readings;
      const matchingReading = this.combinedReadings.find(r =>
        r.dt === firstReading.dt &&
        r.alt === firstReading.alt &&
        r.lat === firstReading.lat
      );
  
      if (matchingReading) {
        matchingReading.isSynced = true;
      }
    } else {
      this.combinedReadings.forEach(reading => {
        if (reading.type === type) {
          reading.isSynced = true;
        }
      });
      this.disableSyncButton = true;
    }
  }
}
