import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { GpsData } from '../models/gps-data.model';
import { environment } from '../../environments/environment'; 

@Injectable({
  providedIn: 'root'
})
export class GpsService {

  private gpsDataUrl = `${environment.dataApiUrl}/DataCollector/GPS`;
  
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor(private http: HttpClient) { }
  /**
   * Sends GPS data to the server.
   * @param data The GPS data to be sent, formatted according to the GpsData model.
   * @returns An Observable that emits the server's response.
   *
   */ 
  sendGpsData(data: GpsData): Observable<any> { // Use the GpsData model
    return this.http.post(this.gpsDataUrl, data, this.httpOptions)
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
