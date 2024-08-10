import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OsrmResponse } from '../models/osrm-response.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OsrmService {
 
  private baseUrl = `${environment.osrmApiUrl}//route/v1/driving`;

  constructor(private http: HttpClient) { }
  
  /**
   * Fetches a driving route from the OSRM API between the specified start and end points.
   * @param start The starting coordinates (latitude and longitude) of the route.
   * @param end The ending coordinates (latitude and longitude) of the route.
   * @returns An Observable that emits an OsrmResponse object containing the route data.
   */
  getRoute(start: { lat: number, lon: number }, end: { lat: number, lon: number }): Observable<OsrmResponse> {
    const coordinates = `${start.lon},${start.lat};${end.lon},${end.lat}`;
    const url = `${this.baseUrl}/${coordinates}`;

    const params = new HttpParams()
      .set('overview', 'full')
      .set('geometries', 'geojson');

    return this.http.get<OsrmResponse>(url, { params })
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Handles HTTP errors that may occur during server communication.
   * @param error The HttpErrorResponse object containing error details.
   * @returns An Observable that throws an error message.
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('An error occurred:', error.message);
    return throwError('Something went wrong; please try again later.');
  }
}