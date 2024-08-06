export interface AccelerometerReading {
    x: number;
    y: number;
    z: number;
    dt: string;
    isSynced: boolean,
  }
  
  export interface AccelerometerData {
    Data: AccelerometerReading[];
    SensorId: string;
  }