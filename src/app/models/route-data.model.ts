export interface RouteData {
    isAutoSync: boolean;
    dataSource: number;
    gpsSensorId: string;
    accelerometerSensorId: string;
    start?: { lat: number; lon: number };
    destination?: { lat: number; lon: number };
    coordinates?: number[][];
  }