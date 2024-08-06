export interface OsrmWaypoint {
    hint: string;
    distance: number;
    name: string;
    location: number[];
  }
  
  export interface OsrmRouteLeg {
    steps: any[];
    summary: string;
    weight: number;
    duration: number;
    distance: number;
  }
  
  export interface OsrmRoute {
    geometry: {
      coordinates: number[][];
      type: string;
    };
    legs: OsrmRouteLeg[];
    weight_name: string;
    weight: number;
    duration: number;
    distance: number;
  }
  
  export interface OsrmResponse {
    code: string;
    routes: OsrmRoute[];
    waypoints: OsrmWaypoint[];
  }
  