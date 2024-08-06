import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AccelerometerData } from '../models/accelerometer-data.model';

@Injectable({
  providedIn: 'root'
})
export class AccelerometerService {

  private accelerometerDataUrl = 'http://173.35.143.161:1976/DataCollector/Accelerometer';
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor(private http: HttpClient) { }

  sendAccelerometerData(data: AccelerometerData): Observable<any> {
    return this.http.post(this.accelerometerDataUrl, data, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('An error occurred:', error.message);
    return throwError('Something went wrong; please try again later.');
  }
}
