import { describe, it, expect, vi } from 'vitest';
import {
  isFuelAvailable,
  shouldPollToday,
  getDayOfMonth,
  FuelMonitor,
} from '../src/monitor/fuel-monitor.js';
import type { Fuel, Station, TileCoord } from '../src/types.js';
import type { StateStore } from '../src/state/memory-store.js';
import type { EventSender } from '../src/notifications/email-notifier.js';

const TILE: TileCoord = { z: 13, x: 5081, y: 2593 };
const STATION_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

function makeFuel(type: string, status: string): Fuel {
  return { type, availabilityStatus: status };
}

function makeStation(
  id: string,
  name: string,
  fuels: Fuel[],
  operationsCount?: number
): Station {
  return {
    id,
    name,
    fuels,
    ...(operationsCount !== undefined ? { operationsCount } : {}),
  };
}

describe('isFuelAvailable', () => {
  it('returns true when available and operationsCount >= 4', () => {
    expect(isFuelAvailable(5, [makeFuel('ai95', 'available')], 'ai95')).toBe(true);
  });

  it('returns true when operationsCount is exactly 4', () => {
    expect(isFuelAvailable(4, [makeFuel('ai95', 'available')], 'ai95')).toBe(true);
  });

  it('returns false when available but operationsCount < 4', () => {
    expect(isFuelAvailable(3, [makeFuel('ai95', 'available')], 'ai95')).toBe(false);
  });

  it('returns false when not available but operationsCount >= 4', () => {
    expect(isFuelAvailable(5, [makeFuel('ai95', 'unknown')], 'ai95')).toBe(false);
  });

  it('returns false when operationsCount is undefined (treated as 0)', () => {
    expect(isFuelAvailable(undefined, [makeFuel('ai95', 'available')], 'ai95')).toBe(false);
  });

  it('returns false when fuel type not found', () => {
    expect(isFuelAvailable(5, [makeFuel('ai95', 'available')], 'ai92')).toBe(false);
  });
});

describe('getDayOfMonth', () => {
  it('returns day in specified timezone', () => {
    const date = new Date('2026-09-09T12:00:00+03:00');
    expect(getDayOfMonth(date, 'Europe/Moscow')).toBe(9);
  });

  it('handles timezone boundary correctly', () => {
    const date = new Date('2026-09-09T23:30:00+03:00');
    expect(getDayOfMonth(date, 'Europe/Moscow')).toBe(9);
  });
});

describe('shouldPollToday', () => {
  const tz = 'Europe/Moscow';

  it('odd plate on odd day returns true', () => {
    const date = new Date('2026-09-09T12:00:00+03:00');
    expect(shouldPollToday('odd', date, tz)).toBe(true);
  });

  it('odd plate on even day returns false', () => {
    const date = new Date('2026-09-08T12:00:00+03:00');
    expect(shouldPollToday('odd', date, tz)).toBe(false);
  });

  it('even plate on even day returns true', () => {
    const date = new Date('2026-09-08T12:00:00+03:00');
    expect(shouldPollToday('even', date, tz)).toBe(true);
  });

  it('even plate on odd day returns false', () => {
    const date = new Date('2026-09-09T12:00:00+03:00');
    expect(shouldPollToday('even', date, tz)).toBe(false);
  });
});

interface MockStateStore extends StateStore {
  states: Map<string, boolean>;
}

function makeMockDB(): MockStateStore {
  const states = new Map<string, boolean>();
  return {
    states,
    getState: vi.fn((stationId: string, fuelType: string): boolean | null => {
      return states.get(`${stationId}:${fuelType}`) ?? null;
    }),
    setState: vi.fn((stationId: string, fuelType: string, available: boolean): void => {
      states.set(`${stationId}:${fuelType}`, available);
    }),
    close: vi.fn((): void => {}),
  };
}

function makeMockNotifier(): EventSender & {
  sendEvents: ReturnType<typeof vi.fn>;
} {
  return {
    sendEvents: vi.fn(async (): Promise<void> => {}),
  };
}

describe('FuelMonitor.check', () => {
  const baseConfig = {
    stations: [TILE],
    fuelTypes: ['ai95'],
    plateType: 'odd' as const,
    timezone: 'Europe/Moscow',
  };

  it('emits appeared event when fuel becomes available', async () => {
    const station = makeStation(
      STATION_ID,
      'АЗС Тест',
      [makeFuel('ai95', 'available')],
      5
    );
    const fetcher = vi.fn(async () => [station]);
    const db = makeMockDB();
    db.states.set(`${STATION_ID}:ai95`, false);
    const notifier = makeMockNotifier();

    const monitor = new FuelMonitor(baseConfig, { fetcher, database: db, notifier });
    const result = await monitor.check(new Date('2026-09-09T12:00:00+03:00'));

    expect(result.skipped).toBe(false);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.type).toBe('appeared');
    expect(result.events[0]?.stationName).toBe('АЗС Тест');
    expect(notifier.sendEvents).toHaveBeenCalledOnce();
  });

  it('emits disappeared event when fuel becomes unavailable', async () => {
    const station = makeStation(
      STATION_ID,
      'АЗС Тест',
      [makeFuel('ai95', 'unknown')],
      1
    );
    const fetcher = vi.fn(async () => [station]);
    const db = makeMockDB();
    db.states.set(`${STATION_ID}:ai95`, true);
    const notifier = makeMockNotifier();

    const monitor = new FuelMonitor(baseConfig, { fetcher, database: db, notifier });
    const result = await monitor.check(new Date('2026-09-09T12:00:00+03:00'));

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.type).toBe('disappeared');
    expect(notifier.sendEvents).toHaveBeenCalledOnce();
  });

  it('does not emit when state unchanged (still available)', async () => {
    const station = makeStation(
      STATION_ID,
      'АЗС Тест',
      [makeFuel('ai95', 'available')],
      5
    );
    const fetcher = vi.fn(async () => [station]);
    const db = makeMockDB();
    db.states.set(`${STATION_ID}:ai95`, true);
    const notifier = makeMockNotifier();

    const monitor = new FuelMonitor(baseConfig, { fetcher, database: db, notifier });
    const result = await monitor.check(new Date('2026-09-09T12:00:00+03:00'));

    expect(result.events).toHaveLength(0);
    expect(notifier.sendEvents).not.toHaveBeenCalled();
  });

  it('does not emit when state unchanged (still unavailable)', async () => {
    const station = makeStation(
      STATION_ID,
      'АЗС Тест',
      [makeFuel('ai95', 'unknown')],
      1
    );
    const fetcher = vi.fn(async () => [station]);
    const db = makeMockDB();
    db.states.set(`${STATION_ID}:ai95`, false);
    const notifier = makeMockNotifier();

    const monitor = new FuelMonitor(baseConfig, { fetcher, database: db, notifier });
    const result = await monitor.check(new Date('2026-09-09T12:00:00+03:00'));

    expect(result.events).toHaveLength(0);
    expect(notifier.sendEvents).not.toHaveBeenCalled();
  });

  it('skips on non-matching day and does not call API', async () => {
    const fetcher = vi.fn();
    const db = makeMockDB();
    const notifier = makeMockNotifier();

    const monitor = new FuelMonitor(baseConfig, { fetcher, database: db, notifier });
    const result = await monitor.check(new Date('2026-09-08T12:00:00+03:00'));

    expect(result.skipped).toBe(true);
    expect(result.events).toHaveLength(0);
    expect(fetcher).not.toHaveBeenCalled();
    expect(notifier.sendEvents).not.toHaveBeenCalled();
  });

  it('emits appeared on first check when fuel is available', async () => {
    const station = makeStation(
      STATION_ID,
      'АЗС Тест',
      [makeFuel('ai95', 'available')],
      5
    );
    const fetcher = vi.fn(async () => [station]);
    const db = makeMockDB();
    const notifier = makeMockNotifier();

    const monitor = new FuelMonitor(baseConfig, { fetcher, database: db, notifier });
    const result = await monitor.check(new Date('2026-09-09T12:00:00+03:00'));

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.type).toBe('appeared');
    expect(notifier.sendEvents).toHaveBeenCalledOnce();
    expect(db.states.get(`${STATION_ID}:ai95`)).toBe(true);
  });

  it('does not emit on first check when fuel is unavailable but saves state', async () => {
    const station = makeStation(
      STATION_ID,
      'АЗС Тест',
      [makeFuel('ai95', 'unknown')],
      1
    );
    const fetcher = vi.fn(async () => [station]);
    const db = makeMockDB();
    const notifier = makeMockNotifier();

    const monitor = new FuelMonitor(baseConfig, { fetcher, database: db, notifier });
    const result = await monitor.check(new Date('2026-09-09T12:00:00+03:00'));

    expect(result.events).toHaveLength(0);
    expect(notifier.sendEvents).not.toHaveBeenCalled();
    expect(db.states.get(`${STATION_ID}:ai95`)).toBe(false);
  });

  it('handles missing operationsCount as 0', async () => {
    const station: Station = {
      id: STATION_ID,
      name: 'АЗС Тест',
      fuels: [makeFuel('ai95', 'available')],
    };
    const fetcher = vi.fn(async () => [station]);
    const db = makeMockDB();
    db.states.set(`${STATION_ID}:ai95`, false);
    const notifier = makeMockNotifier();

    const monitor = new FuelMonitor(baseConfig, { fetcher, database: db, notifier });
    const result = await monitor.check(new Date('2026-09-09T12:00:00+03:00'));

    expect(result.events).toHaveLength(0);
    expect(db.states.get(`${STATION_ID}:ai95`)).toBe(false);
  });

  it('processes multiple fuel types', async () => {
    const station = makeStation(
      STATION_ID,
      'АЗС Тест',
      [makeFuel('ai95', 'available'), makeFuel('ai92', 'available')],
      5
    );
    const fetcher = vi.fn(async () => [station]);
    const db = makeMockDB();
    db.states.set(`${STATION_ID}:ai95`, false);
    db.states.set(`${STATION_ID}:ai92`, false);
    const notifier = makeMockNotifier();

    const config = { ...baseConfig, fuelTypes: ['ai95', 'ai92'] };
    const monitor = new FuelMonitor(config, { fetcher, database: db, notifier });
    const result = await monitor.check(new Date('2026-09-09T12:00:00+03:00'));

    expect(result.events).toHaveLength(2);
    expect(result.events.some((e) => e.fuelType === 'ai95')).toBe(true);
    expect(result.events.some((e) => e.fuelType === 'ai92')).toBe(true);
  });
});
