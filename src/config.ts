import dotenv from 'dotenv';
import type { PlateType, TileCoord } from './types.js';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

function parseJsonArray(value: string, name: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (e) {
    throw new Error(`${name} must be valid JSON: ${e instanceof SyntaxError ? e.message : String(e)}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${name} must be a JSON array`);
  }
  return parsed;
}

function parseStations(value: string): TileCoord[] {
  const arr = parseJsonArray(value, 'STATIONS');
  return arr.map((item, i) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`STATIONS[${i}] must be an object`);
    }
    const obj = item as Record<string, unknown>;
    const { z, x, y } = obj;
    if (typeof z !== 'number' || typeof x !== 'number' || typeof y !== 'number') {
      throw new Error(`STATIONS[${i}] must have numeric z, x, y`);
    }
    return { z, x, y };
  });
}

function parseFuelTypes(value: string): string[] {
  const arr = parseJsonArray(value, 'FUEL_TYPES');
  return arr.map((item, i) => {
    if (typeof item !== 'string') {
      throw new Error(`FUEL_TYPES[${i}] must be a string`);
    }
    return item;
  });
}

function parsePlateType(value: string): PlateType {
  if (value !== 'odd' && value !== 'even') {
    throw new Error(`PLATE_TYPE must be 'odd' or 'even', got: ${value}`);
  }
  return value;
}

export interface Config {
  stations: TileCoord[];
  fuelTypes: string[];
  plateType: PlateType;
  pollCron: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  notificationEmail: string;
  timezone: string;
}

export function loadConfig(): Config {
  const stations = parseStations(required('STATIONS'));
  const fuelTypes = parseFuelTypes(required('FUEL_TYPES'));
  const plateType = parsePlateType(required('PLATE_TYPE'));
  const pollCron = process.env['POLL_CRON'] ?? '*/5 * * * *';
  const smtpHost = process.env['SMTP_HOST'] ?? 'smtp.gmail.com';
  const smtpPortRaw = process.env['SMTP_PORT'] ?? '465';
  const smtpPort = Number(smtpPortRaw);
  const smtpUser = required('SMTP_USER');
  const smtpPass = required('SMTP_PASS');
  const notificationEmail = required('NOTIFICATION_EMAIL');
  const timezone = process.env['TZ'] ?? 'Europe/Moscow';

  if (Number.isNaN(smtpPort)) {
    throw new Error(`SMTP_PORT must be a number, got: ${smtpPortRaw}`);
  }

  return {
    stations,
    fuelTypes,
    plateType,
    pollCron,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    notificationEmail,
    timezone,
  };
}
