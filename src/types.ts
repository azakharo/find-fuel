export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

export type PlateType = 'odd' | 'even';

export interface Fuel {
  type: string;
  availabilityStatus: string;
  available?: boolean;
  limitLiters?: number;
}

export interface StationLocation {
  lat: number;
  lon: number;
  address?: string;
}

export interface Station {
  id: string;
  branchId?: string;
  name: string;
  address?: string;
  location?: StationLocation;
  availabilityStatus?: string;
  lastPaymentAt?: string;
  updatedAt?: string;
  operationsCount?: number;
  fuels: Fuel[];
}

export interface SberAZSResponse {
  apiVersion?: number;
  dataVersion?: string;
  snapshotVersion?: string;
  version?: string;
  stationCount?: number;
  hiddenStationCount?: number;
  lastSuccessfulPullAt?: string;
  lastErrorPresent?: boolean;
  stations: Station[];
}

export type FuelEventType = 'appeared' | 'disappeared';

export interface FuelEvent {
  stationId: string;
  stationName: string;
  fuelType: string;
  type: FuelEventType;
  timestamp: Date;
}
