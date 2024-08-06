import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AltitudeService {

  private baseUrl = 'https://api.open-meteo.com/v1/elevation';
  private previousAltitude: number = 0;

  constructor(private http: HttpClient) {}

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
        // For the sake of demo, if the api returns error
        if (this.previousAltitude !== 0) {
          // Return the previous altitude if available
          return of(this.previousAltitude);
        } else {
          // calculate an approximate altitude if previous altitude is 0
          const calculatedAltitude = this.calculateApproximateAltitude(lat, lon);
          return of(calculatedAltitude);
        }
      })
    );
  }

  private calculateApproximateAltitude(lat: number, lon: number): number {
    // Simplified approximation based on coordinates
    // This is just a placeholder for a real altitude calculation method
    return Math.abs(lat) * 10 + Math.abs(lon) * 5;
  }

  private logError(error: HttpErrorResponse): void {
    console.error('An error occurred:', error.message);
  }
}
