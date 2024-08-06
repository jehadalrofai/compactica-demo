export interface RouteData {
    dataSource: number;
    gpsSensorId: string;
    accelerometerSensorId: string;
    duration: number;
    start?: { lat: number; lon: number };
    destination?: { lat: number; lon: number };
    coordinates?: number[][];
  }