import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

export interface StateStore {
  getState(stationId: string, fuelType: string): boolean | null;
  setState(stationId: string, fuelType: string, available: boolean, updatedAt: string): void;
  close(): void;
}

export class FuelDatabase implements StateStore {
  private db: DatabaseType;

  constructor(path: string) {
    const dir = dirname(path);
    mkdirSync(dir, { recursive: true });
    this.db = new Database(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS station_states (
        station_id TEXT NOT NULL,
        fuel_type TEXT NOT NULL,
        available INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (station_id, fuel_type)
      )
    `);
  }

  getState(stationId: string, fuelType: string): boolean | null {
    const row = this.db
      .prepare('SELECT available FROM station_states WHERE station_id = ? AND fuel_type = ?')
      .get(stationId, fuelType) as { available: number } | undefined;
    if (row === undefined) return null;
    return row.available === 1;
  }

  setState(stationId: string, fuelType: string, available: boolean, updatedAt: string): void {
    this.db
      .prepare(
        `INSERT INTO station_states (station_id, fuel_type, available, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(station_id, fuel_type) DO UPDATE SET available = excluded.available, updated_at = excluded.updated_at`
      )
      .run(stationId, fuelType, available ? 1 : 0, updatedAt);
  }

  close(): void {
    this.db.close();
  }
}
