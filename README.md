# Compactica Demo Application

## Overview
This project is a data tracking application built with Angular 18 and Node.js 22. It leverages various services to simulate and monitor GPS and Accelerometer data, which are visualized on a map and in a live data table. The application allows users to configure data sources, view real-time readings, and sync data to a backend server.

## Features
- Data Configuration: Users can configure the data source (GPS, Accelerometer, or both), provide sensor IDs, and set up a route for GPS data simulation.
- Real-Time Data Tracking: The application displays live readings from GPS and Accelerometer sensors in a tabular format.
- Map Visualization: GPS data is visualized on an interactive map using the Leaflet library.
- Data Synchronization: Users can manually or automatically sync collected data to the backend server.

## Data Sources and Simulation
1. GPS Data
Route Setup: Users enter starting and destination coordinates in the configuration form.
Route Calculation: The application uses the OSRM API to determine a suitable route between the provided coordinates.
Simulation: When the user starts the simulation, the application calculates the movement along the route based on speed settings configured in the environment file. At each step, the new coordinates (longitude, magnitude, and altitude) are saved.
2. Accelerometer Data
Random Data Generation: If the accelerometer is selected as the data source (either alone or with GPS), the application generates random accelerometer readings. These readings are saved and can be synchronized with the backend.
3. Both GPS and Accelerometer Data
Combined Simulation: When both data sources are selected, the application simulates GPS movement along the calculated route while simultaneously generating random accelerometer readings. Both sets of data are stored and can be viewed and synced.

# Usage

## Configuration
1- Data Source: Choose between GPS only, Accelerometer only, or Both.
2- GPS Sensor ID: Enter the ID for the GPS sensor.
3- Starting Point & Destination: Provide actual coordinates in the format lat, lon to define the route for GPS data simulation.
4- Accelerometer Sensor ID: Enter the ID for the accelerometer sensor (required if Accelerometer is selected).
5- Auto Sync: Check this box if you want the readings to be automatically saved to the backend.



## Data Tracking
After configuration, submit the form to start tracking data.
1- Start Simulation: Click the Start button to begin collecting data.
2- View Data: Monitor the latest readings in the Last Reading section and see live updates in the table.
3- Sync Data: Sync the data to the backend server using the Sync button or let it happen automatically based on your configuration.

## API Integration
The application integrates with the following APIs:

1- OSRM API: For route Latitude and Longitude calculation based on GPS coordinates.
2- METEO API: For Altitude calculation based on Latitude and Longitude.
3- Backend API: For submitting GPS and Accelerometer data.

## Environment Configuration
The backend URLs and other configuration parameters can be managed through the environment.ts file for different environments like development and production.

## Technologies Used
Angular 18: Frontend framework.
Node.js 22: Backend runtime.
RxJS: For handling asynchronous data streams.
Leaflet: For map visualization.
Bootstrap: For styling the UI components.

# Run the App

## Install Dependencies
Run `npm install` to install all the necessary dependencies:

## Development server
Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`.

## Build
Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.