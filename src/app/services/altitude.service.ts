import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment'; 
@Injectable({
  providedIn: 'root'
})
export class AltitudeService {
  
  private baseUrl = `${environment.meteoApiUrl}/v1/elevation`;
  private previousAltitude: number = 0;

  constructor(private http: HttpClient) {}
  
  /**
   * Retrieves the altitude for a given latitude and longitude using the Open Meteo API.
   * If the API request fails, the method attempts to return the last successfully retrieved altitude,
   * or an approximate altitude calculated based on the coordinates.
   * 
   * @param lat The latitude for which to retrieve the altitude.
   * @param lon The longitude for which to retrieve the altitude.
   * @returns An Observable emitting the altitude value in meters.
   */
  getAltitude(lat: number, lon: number): Observable<number> {
    const url = `${this.baseUrl}?latitude=${lat}&longitude=${lon}`;
    return this.http.get<any>(url).pipe(
      map(response => {
        const elevation = response.elevation[0];
        this.previousAltitude = elevation;
        return elevation;
      }),
      catchError(error => {
        this.logError(error);
        // Return the previous altitude if available, otherwise calculate an approximate value
        if (this.previousAltitude !== 0) {
          return of(this.previousAltitude);
        } else {
          const calculatedAltitude = this.calculateApproximateAltitude(lat, lon);
          return of(calculatedAltitude);
        }
      })
    );
  }
  /**
   * Calculates an approximate altitude based on the latitude and longitude.
   * This method is used as a fallback when the API request fails and no previous altitude is available.
   * 
   * @param lat The latitude used to calculate the approximate altitude.
   * @param lon The longitude used to calculate the approximate altitude.
   * @returns A number representing the calculated approximate altitude.
   */
  private calculateApproximateAltitude(lat: number, lon: number): number {
    return Math.abs(lat) * 10 + Math.abs(lon) * 5;
  }

  /**
   * Logs the error message to the console. This method is used internally to handle errors.
   * 
   * @param error The HttpErrorResponse object containing error details.
   */
  private logError(error: HttpErrorResponse): void {
    console.error('An error occurred:', error.message);
  }
}
