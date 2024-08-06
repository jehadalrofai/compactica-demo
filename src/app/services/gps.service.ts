import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { GpsData } from '../models/gps-data.model';

@Injectable({
  providedIn: 'root'
})
export class GpsService {

  private gpsDataUrl = 'http://173.35.143.161:1976/DataCollector/GPS';

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor(private http: HttpClient) { }

  sendGpsData(data: GpsData): Observable<any> { // Use the GpsData model
    return this.http.post(this.gpsDataUrl, data, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('An error occurred:', error.message);
    return throwError('Something went wrong; please try again later.');
  }
}
