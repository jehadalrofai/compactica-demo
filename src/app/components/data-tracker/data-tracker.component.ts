import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { Subscription, interval } from 'rxjs';
import * as L from 'leaflet';
import * as turf from '@turf/turf';

import { AccelerometerService } from '../../services/accelerometer.service';
import { GpsRouteDataService } from '../../services/gps-route-data.service';
import { ServerTimeService } from '../../services/server-time.service';
import { AltitudeService } from '../../services/altitude.service'; 
import { GpsService } from '../../services/gps.service';
import { RouteData } from '../../models/route-data.model';
import { AccelerometerData, AccelerometerReading } from '../../models/accelerometer-data.model';
import { GpsData, GpsReading } from '../../models/gps-data.model';

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
  private map!: L.Map;
  private routeLayer!: L.LayerGroup;
  private marker!: L.Marker | null;
  private movementSubscription: Subscription | null = null;
  private routeDataSubscription: Subscription;
  private timeSubscription: Subscription | null = null;
  
  private currentIndex: number = 0;
  private smallIcon: L.Icon = L.icon({
    iconUrl: '/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41] 
  });

  public currentAccelerometerId: string = '';
  public currentGPSId: string = '';
  public coordinates: number[][] = [];
  public combinedReadings: CombinedReading[] = [];  // Unified array
  
  public isRunning: boolean = false;
  public startButtonText: string = 'Start';
  public currentServerTime: string = '';
  public disableSyncButton: boolean = true;
  public isAutoSync: boolean = false;
  public selectedDataSource: number = 0; // Default to GPS only

  constructor(
    private accelerometerService: AccelerometerService,
    private gpsRouteDataService: GpsRouteDataService,
    private gpsService: GpsService,
    private serverTimeService: ServerTimeService,
    private altitudeService: AltitudeService,
    private toastr: ToastrService,
  ) {
    this.routeDataSubscription = this.gpsRouteDataService.currentRouteData.subscribe((data: RouteData | null) => {
      if (data) {
        this.selectedDataSource = data.dataSource;
        this.currentGPSId = data.gpsSensorId;
        this.currentAccelerometerId = data.accelerometerSensorId;
        this.coordinates = data.coordinates || [];
        if (this.selectedDataSource === 1 || this.selectedDataSource === 3) {
          this.drawRoute(this.coordinates);
        }
      }
    });

    this.timeSubscription = this.serverTimeService.getLocalClock().subscribe(time => {
      if (time) {
        this.currentServerTime = time.toISOString();
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.selectedDataSource === 1 || this.selectedDataSource === 3) {
      this.initMap();
    }
  }

  ngOnDestroy(): void {
    if (this.routeDataSubscription) {
      this.routeDataSubscription.unsubscribe();
    }
    if (this.timeSubscription) {
      this.timeSubscription.unsubscribe();
    }
    this.stopSimulation();
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

  public startSimulation(): void {
    this.serverTimeService.syncLocalClock().subscribe(
      () => {
        if ((this.selectedDataSource === 1 || this.selectedDataSource === 3) && this.coordinates.length > 0) {
          this.gpsRouteDataService.updateRouteInProgress(true);
          if (!this.marker && this.currentIndex < this.coordinates.length && (this.selectedDataSource === 1 || this.selectedDataSource === 3)) {
            const [lon, lat] = this.coordinates[this.currentIndex];
            this.marker = L.marker([lat, lon], { icon: this.smallIcon }).addTo(this.map);
          }
          this.isRunning = true;
          this.simulateGPSMovement();
        } else if(this.selectedDataSource === 2 ){
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
              this.syncData([newPosition]);
            }
          });
        }

        if (this.selectedDataSource === 3) {
          this.addRandomAccelerometerReading(currentTime);
        }
      }
    });
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
      this.syncData([newReading]);
    }
  }

  public syncData(readings: CombinedReading[]): void {
    if (this.selectedDataSource === 1 || this.selectedDataSource === 3) {
        // Sync GPS Data
        const gpsData: GpsData = {
            Data: readings.filter(reading => reading.type === 'gps') as GpsReading[],
            SensorId: this.currentGPSId
        };

        this.gpsService.sendGpsData(gpsData).subscribe(
            response => {
                console.log('GPS data sent successfully', response);
                this.updateSyncStatus('gps', readings);
            },
            error => {
                console.error('Failed to send GPS data', error);
                this.toastr.error('Failed to sync GPS reading.');
            }
        );
    }

    if (this.selectedDataSource === 2 || this.selectedDataSource === 3) {
        // Sync Accelerometer Data
        const accelerometerData: AccelerometerData = {
            Data: readings.filter(reading => reading.type === 'accelerometer') as AccelerometerReading[],
            SensorId: this.currentAccelerometerId,
        };

        this.accelerometerService.sendAccelerometerData(accelerometerData).subscribe(
            response => {
                console.log('Accelerometer data sent successfully', response);
                this.updateSyncStatus('accelerometer', readings);
            },
            error => {
                console.error('Failed to send accelerometer data', error);
                this.toastr.error('Failed to sync accelerometer reading.');
            }
        );
    }
}

private updateSyncStatus(type: 'gps' | 'accelerometer', readings: CombinedReading[]): void {
    readings.forEach(reading => {
        if (reading.type === type) {
            reading.isSynced = true;
        }
    });

    // Update sync button state if all entries are synced
    if (this.combinedReadings.every(reading => reading.isSynced)) {
        this.disableSyncButton = true;
    }
}

private getRandomValue(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

private drawRoute(coordinates: number[][]): void {
    this.routeLayer.clearLayers();

    const latlngs = coordinates.map(coord => [coord[1], coord[0]] as [number, number]);
    const polyline = L.polyline(latlngs, { color: 'blue' }).addTo(this.routeLayer);

    this.map.fitBounds(polyline.getBounds());
}

public stopSimulation(): void {
    if (this.movementSubscription) {
      this.movementSubscription.unsubscribe();
      this.movementSubscription = null;
      this.startButtonText = 'Resume';
      this.isRunning = false;
    }
}

public resetSimulation(): void {
    this.stopSimulation();
    this.combinedReadings = [];
    this.currentIndex = 0;
    this.isRunning = false;
    this.startButtonText = 'Start';

    if (this.coordinates.length > 0 && (this.selectedDataSource === 1 || this.selectedDataSource === 3)) {
      const [initialLon, initialLat] = this.coordinates[0];
      if (this.marker) {
        this.marker.setLatLng([initialLat, initialLon]);
      } else {
        this.marker = L.marker([initialLat, initialLon], { icon: this.smallIcon }).addTo(this.map);
      }
      this.map.panTo([initialLat, initialLon]);
    }

    this.serverTimeService.stopLocalClock();
    this.gpsRouteDataService.updateRouteInProgress(false);
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
}