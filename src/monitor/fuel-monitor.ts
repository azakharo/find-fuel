import type { StateStore } from '../state/memory-store.js';
import type { EventSender } from '../notifications/email-notifier.js';
import type { StationFetcher } from '../api/sberazs-client.js';
import type { Fuel, FuelEvent, PlateType, Station, TileCoord } from '../types.js';

export function isFuelAvailable(
  operationsCount: number | undefined,
  fuels: Fuel[],
  targetFuelType: string
): boolean {
  const fuel = fuels.find((f) => f.type === targetFuelType);
  if (fuel === undefined) return false;
  const count = operationsCount ?? 0;
  return fuel.availabilityStatus === 'available' && count >= 4;
}

export function getDayOfMonth(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    day: 'numeric',
  }).formatToParts(date);
  const dayPart = parts.find((p) => p.type === 'day');
  if (dayPart === undefined) {
    throw new Error('Could not determine day of month from date');
  }
  return Number(dayPart.value);
}

export function shouldPollToday(plateType: PlateType, date: Date, timezone: string): boolean {
  const day = getDayOfMonth(date, timezone);
  const isOdd = day % 2 === 1;
  if (plateType === 'odd') return isOdd;
  return !isOdd;
}

export interface FuelMonitorConfig {
  stations: TileCoord[];
  fuelTypes: string[];
  plateType: PlateType;
  timezone: string;
}

export interface FuelMonitorDeps {
  fetcher: StationFetcher;
  database: StateStore;
  notifier: EventSender;
}

export interface CheckResult {
  events: FuelEvent[];
  skipped: boolean;
}

export class FuelMonitor {
  constructor(
    private readonly config: FuelMonitorConfig,
    private readonly deps: FuelMonitorDeps
  ) {}

  async check(date: Date = new Date()): Promise<CheckResult> {
    if (!shouldPollToday(this.config.plateType, date, this.config.timezone)) {
      return { events: [], skipped: true };
    }

    const events: FuelEvent[] = [];

    for (const tile of this.config.stations) {
      const stations = await this.deps.fetcher(tile);
      for (const station of stations) {
        for (const fuelType of this.config.fuelTypes) {
          const wasAvailable = this.deps.database.getState(station.id, fuelType);
          const isAvailable = isFuelAvailable(station.operationsCount, station.fuels, fuelType);

          if (wasAvailable === null) {
            if (isAvailable) {
              events.push({
                stationId: station.id,
                stationName: station.name,
                fuelType,
                type: 'appeared',
                timestamp: date,
              });
            }
            this.deps.database.setState(station.id, fuelType, isAvailable, date.toISOString());
            continue;
          }

          if (wasAvailable && !isAvailable) {
            events.push({
              stationId: station.id,
              stationName: station.name,
              fuelType,
              type: 'disappeared',
              timestamp: date,
            });
          } else if (!wasAvailable && isAvailable) {
            events.push({
              stationId: station.id,
              stationName: station.name,
              fuelType,
              type: 'appeared',
              timestamp: date,
            });
          }

          this.deps.database.setState(station.id, fuelType, isAvailable, date.toISOString());
        }
      }
    }

    if (events.length > 0) {
      await this.deps.notifier.sendEvents(events);
    }

    return { events, skipped: false };
  }
}
