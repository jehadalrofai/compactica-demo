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
  
  /**
   * Updates the current route data with the provided RouteData object.
   * @param routeData The RouteData object containing all necessary route information.
   */
  updateRouteData(routeData: RouteData) {
    this.routeDataSource.next(routeData);
  }

  /**
   * Updates the active status of the data configuration.
   * @param value The new active status (true or false).
   */
  updateIsActive(value: boolean) {
    this.isActiveSource.next(value);
  }
  
  /**
   * Clears the current route data and emits an event to clear the form.
   */
  clearRouteData() {
    this.routeDataSource.next(null);
    this.clearFormSource.next(true);
  }
}