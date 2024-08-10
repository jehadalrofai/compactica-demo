import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, interval, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment'; 

@Injectable({
  providedIn: 'root'
})
export class ServerTimeService {

  private serverTimeUrl = `${environment.dataApiUrl}/DataCollector/Time`;
  private localClock = new BehaviorSubject<Date | null>(null);
  private clockSubscription: Subscription | null = null;
  private lastSyncedTime: Date | null = null;
  private lastSyncTimestamp: number | null = null;

  constructor(private http: HttpClient) {}
  
  /**
   * Fetches the current time from the server.
   * @returns An Observable that emits the server time as a Date object.
   */
  getServerTime(): Observable<Date> {
    return this.http.get<{ serverTime: string }>(this.serverTimeUrl).pipe(
      map(response => new Date(response.serverTime)),
      catchError(this.handleError)
    );
  }

  /**
   * Synchronizes the local clock with the server time.
   * Updates the local clock observable and starts the local clock simulation.
   * @returns An Observable that emits the synchronized server time as a Date object.
   */
  syncLocalClock(): Observable<Date> {
    return this.getServerTime().pipe(
      map(serverTime => {
        this.lastSyncedTime = serverTime;
        this.lastSyncTimestamp = Date.now();
        this.localClock.next(serverTime);
        this.startLocalClock();
        return serverTime;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Provides an observable of the local clock, which emits the simulated local time.
   * @returns An Observable that emits the current simulated local time as a Date object or null if not set.
   */
  getLocalClock(): Observable<Date | null> {
    return this.localClock.asObservable();
  }
  
  /**
   * Starts the local clock simulation, updating the local time every second.
   * The simulated time is based on the last synced server time and the elapsed time since the last sync.
   */
  private startLocalClock(): void {
    if (this.clockSubscription) {
      this.clockSubscription.unsubscribe(); 
    }

    this.clockSubscription = interval(1000).subscribe(() => {
      if (this.lastSyncedTime && this.lastSyncTimestamp !== null) {
        const elapsed = Date.now() - this.lastSyncTimestamp;
        const simulatedTime = new Date(this.lastSyncedTime.getTime() + elapsed);
        this.localClock.next(simulatedTime);
      }
    });
  }
  
  /**
   * Stops the local clock simulation and clears the current local time.
   */
  stopLocalClock(): void {
    if (this.clockSubscription) {
      this.clockSubscription.unsubscribe();
      this.clockSubscription = null;
    }
    this.clearLocalClock();
  }
  
  /**
   * Clears the local clock, setting its value to null.
   */
  clearLocalClock(): void {
    this.localClock.next(null);
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
