import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OsrmResponse } from '../models/osrm-response.model';

@Injectable({
  providedIn: 'root'
})
export class OsrmService {

  private baseUrl = 'https://router.project-osrm.org/route/v1/driving';

  constructor(private http: HttpClient) { }

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

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('An error occurred:', error.message);
    return throwError('Something went wrong; please try again later.');
  }
}