import { AfterViewInit, Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { Subscription, interval } from 'rxjs';
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
  public combinedReadings: CombinedReading[] = [];  // Unified array
  public coordinates: number[][] = [];
  public currentAccelerometerId: string = '';
  public currentGPSId: string = '';
  public currentServerTime: string = '';
  public disableSyncButton: boolean = true;
  public isAutoSync: boolean = false;
  public isRunning: boolean = false;
  public selectedDataSource: number = 0; // Default to GPS only
  public startButtonText: string = 'Start';

  private accelerometerDuration: number = 0;
  private currentIndex: number = 0;
  private map!: L.Map;
  private marker: L.Marker | null = null;
  private movementSubscription: Subscription | null = null;
  private subscriptions = new Subscription();
  private routeLayer!: L.LayerGroup;
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
    this.subscriptions.add(
      this.dataConfigService.currentRouteData.subscribe((data: RouteData | null) => {
        if (data) {
          this.selectedDataSource = data.dataSource;
          this.currentGPSId = data.gpsSensorId;
          this.currentAccelerometerId = data.accelerometerSensorId;
          this.coordinates = data.coordinates || [];
          if (this.selectedDataSource !== 2) {
            this.initMap();
            this.drawRoute(this.coordinates);
          }
          else{
            this.accelerometerDuration = data.duration
          }
        }
      })
    );

    this.subscriptions.add(
      this.serverTimeService.getLocalClock().subscribe(time => {
				 
        this.currentServerTime = time?.toISOString() || '';
      })
    );
  }

  ngAfterViewInit(): void {
    if (this.selectedDataSource === 1 || this.selectedDataSource === 3) {
      this.initMap();
    }
  }

  ngOnDestroy(): void {
    if (this.subscriptions) {
      this.subscriptions.unsubscribe();
    }
    if (this.timeSubscription) {
      this.timeSubscription.unsubscribe();
    }
    this.stopSimulation();
  }

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

  public resetSimulation(): void {
    this.stopSimulation();
    this.resetState();
    this.repositionMarker();
    this.serverTimeService.stopLocalClock();
    this.dataConfigService.updateIsActive(false);
    this.dataConfigService.clearRouteData();
    this.setActiveTab.emit('configurations');
  }

  private resetState(): void {
    this.combinedReadings = [];
    this.currentIndex = 0;
    this.isRunning = false;
    this.startButtonText = 'Start';
  }

  public startSimulation(): void {
    this.serverTimeService.syncLocalClock().subscribe(
      () => {
        if ((this.selectedDataSource === 1 || this.selectedDataSource === 3) && this.coordinates.length > 0) {
          if (!this.marker && this.currentIndex < this.coordinates.length && (this.selectedDataSource === 1 || this.selectedDataSource === 3)) {
            const [lon, lat] = this.coordinates[this.currentIndex];
            this.marker = L.marker([lat, lon], { icon: this.smallIcon }).addTo(this.map);
          }
          this.isRunning = true;
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

  public stopSimulation(): void {
    if (this.movementSubscription) {
      this.movementSubscription.unsubscribe();
      this.movementSubscription = null;
      this.startButtonText = 'Resume';
      this.isRunning = false;
    }
  }

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

    if (this.isAutoSync) {
      const accelerometerData: AccelerometerData = {
        Data: [newReading as AccelerometerReading],
        SensorId: this.currentAccelerometerId,
      };
      this.submitAccelerometerData(accelerometerData);
    }
  }

  private drawRoute(coordinates: number[][]): void {
    this.routeLayer.clearLayers();

    const latlngs = coordinates.map(coord => [coord[1], coord[0]] as [number, number]);
    const polyline = L.polyline(latlngs, { color: 'blue' }).addTo(this.routeLayer);

    this.map.fitBounds(polyline.getBounds());
  }

  private getRandomValue(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

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

  private simulateAccelerometerReadings(): void {
    this.movementSubscription = interval(1000).subscribe(() => {
      this.addRandomAccelerometerReading(this.currentServerTime);
    });
  }

  private simulateGPSMovement(): void {
    this.movementSubscription = interval(1000).subscribe(() => {
      let remainingMoveDistance = 10; // Desired move distance in meters

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
          const destination = turf.destination(currentPoint, remainingMoveDistance / 1000, bearing); // moveDistance in km
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

  private updateSyncStatus(type: 'gps' | 'accelerometer', readings: CombinedReading[]): void {
    if (this.isAutoSync) {
      this.combinedReadings.forEach(reading => {
        if (reading.type === type) {
          reading.isSynced = true;
        }
      });
      this.disableSyncButton = true;
    } else {
      const [firstReading] = readings;
      const matchingReading = this.combinedReadings.find(r =>
        r.dt === firstReading.dt &&
        r.alt === firstReading.alt &&
        r.lat === firstReading.lat
      );
  
      if (matchingReading) {
        matchingReading.isSynced = true;
      }
    }
  }
}
