import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AccelerometerData } from '../models/accelerometer-data.model';
import { environment } from '../../environments/environment'; 

@Injectable({
  providedIn: 'root'
})
export class AccelerometerService {
  
  private accelerometerDataUrl = `${environment.dataApiUrl}/DataCollector/Accelerometer`;
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor(private http: HttpClient) { }

  /**
   * Sends accelerometer data to the server.
   * 
   * @param data The accelerometer data to be sent, structured according to the AccelerometerData model.
   * @returns An Observable that emits the server response or an error.
   */
  sendAccelerometerData(data: AccelerometerData): Observable<any> {
    return this.http.post(this.accelerometerDataUrl, data, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }
  /**
   * Handles HTTP errors that occur during a request.
   * Logs the error to the console and returns an observable that throws an error.
   * 
   * @param error The HttpErrorResponse object containing error details.
   * @returns An Observable that throws an error message.
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('An error occurred:', error.message);
    return throwError('Something went wrong; please try again later.');
  }
}
