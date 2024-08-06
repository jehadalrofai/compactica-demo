import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, interval, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ServerTimeService {

  private serverTimeUrl = 'http://173.35.143.161:1976/DataCollector/Time';
  private localClock = new BehaviorSubject<Date | null>(null);
  private clockSubscription: Subscription | null = null;
  private lastSyncedTime: Date | null = null;
  private lastSyncTimestamp: number | null = null;

  constructor(private http: HttpClient) {}

  getServerTime(): Observable<Date> {
    return this.http.get<{ serverTime: string }>(this.serverTimeUrl).pipe(
      map(response => new Date(response.serverTime)),
      catchError(this.handleError)
    );
  }

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

  getLocalClock(): Observable<Date | null> {
    return this.localClock.asObservable();
  }

  private startLocalClock(): void {
    if (this.clockSubscription) {
      this.clockSubscription.unsubscribe(); // Ensure any previous subscription is cleared
    }

    this.clockSubscription = interval(1000).subscribe(() => {
      if (this.lastSyncedTime && this.lastSyncTimestamp !== null) {
        const elapsed = Date.now() - this.lastSyncTimestamp;
        const simulatedTime = new Date(this.lastSyncedTime.getTime() + elapsed);
        this.localClock.next(simulatedTime);
      }
    });
  }

  stopLocalClock(): void {
    if (this.clockSubscription) {
      this.clockSubscription.unsubscribe();
      this.clockSubscription = null;
    }
    this.clearLocalClock();
  }

  clearLocalClock(): void {
    this.localClock.next(null);
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('An error occurred:', error.message);
    return throwError('Something went wrong; please try again later.');
  }
}
