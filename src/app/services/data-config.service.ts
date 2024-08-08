import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { RouteData } from '../models/route-data.model';

@Injectable({
  providedIn: 'root'
})
export class DataConfigService {
  private clearFormSource = new BehaviorSubject<boolean>(false);
  clearForm = this.clearFormSource.asObservable();
  private isActiveSource = new BehaviorSubject<boolean>(false);
  isActive = this.isActiveSource.asObservable();
  private routeDataSource = new BehaviorSubject<RouteData | null>(null);
  currentRouteData = this.routeDataSource.asObservable();

  
  constructor() {}

  updateRouteData(dataSource: number, gpsSensorId: string, accelerometerSensorId: string, duration: number, start?: { lat: number; lon: number }, destination?: { lat: number; lon: number }, coordinates?: number[][]) {
    const routeData: RouteData = { dataSource, gpsSensorId, accelerometerSensorId, duration, start, destination, coordinates };
    this.routeDataSource.next(routeData);
  }

  updateIsActive(value: boolean) {
    this.isActiveSource.next(value);
  }

  clearRouteData() {
    this.routeDataSource.next(null);
    this.clearFormSource.next(true);
  }
}