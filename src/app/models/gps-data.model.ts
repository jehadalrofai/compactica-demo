  export interface GpsReading {
    lng: number;
    lat: number;
    alt?: number;
    dt: string;
    isSynced: boolean
  }
  
  export interface GpsData {
    Data: GpsReading[];
    SensorId: string;
  }