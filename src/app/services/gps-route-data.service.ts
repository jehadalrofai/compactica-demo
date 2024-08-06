import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { RouteData } from '../models/route-data.model';

@Injectable({
  providedIn: 'root'
})
export class GpsRouteDataService {

  private routeDataSource = new BehaviorSubject<RouteData | null>(null);
  currentRouteData = this.routeDataSource.asObservable();
  private isRouteInProgressSource = new BehaviorSubject<boolean>(false);
  isRouteInProgress = this.isRouteInProgressSource.asObservable();
  
  constructor() {}

  getRouteInProgressValue(): boolean {
    return this.isRouteInProgressSource.getValue();
  }

  updateRouteData(dataSource: number, gpsSensorId: string, accelerometerSensorId: string, duration: number, start?: { lat: number; lon: number }, destination?: { lat: number; lon: number }, coordinates?: number[][]) {
    const routeData: RouteData = { dataSource, gpsSensorId, accelerometerSensorId, duration, start, destination, coordinates };
    this.routeDataSource.next(routeData);
  }

  updateRouteInProgress(value: boolean) {
    this.isRouteInProgressSource.next(value);
  }

  clearRouteData() {
    this.routeDataSource.next(null);
  }
}