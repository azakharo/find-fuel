import { describe, it, expect, vi } from 'vitest';

const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn(async (): Promise<{ messageId: string }> => ({
    messageId: 'test-id',
  })),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({ sendMail: mockSendMail }),
  },
}));

import { EmailNotifier, formatEventMessage } from '../src/notifications/email-notifier.js';
import type { FuelEvent } from '../src/types.js';

const STATION_NAME = 'Лукойл, АЗС №52055';
const TIMESTAMP = new Date('2026-09-09T12:00:00');

describe('formatEventMessage', () => {
  it('formats appeared event correctly', () => {
    const event: FuelEvent = {
      stationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      stationName: STATION_NAME,
      fuelType: 'ai95',
      type: 'appeared',
      timestamp: TIMESTAMP,
    };
    const result = formatEventMessage(event);
    expect(result.subject).toBe('FindFuel: бензин появился');
    expect(result.text).toBe(`На АЗС ${STATION_NAME} появился бензин! Время: 09.09.2026 12:00:00`);
  });

  it('formats disappeared event correctly', () => {
    const event: FuelEvent = {
      stationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      stationName: STATION_NAME,
      fuelType: 'ai95',
      type: 'disappeared',
      timestamp: new Date('2026-09-09T15:30:45'),
    };
    const result = formatEventMessage(event);
    expect(result.subject).toBe('FindFuel: бензин закончился');
    expect(result.text).toBe(`На АЗС ${STATION_NAME} закончился бензин! Время: 09.09.2026 15:30:45`);
  });
});

describe('EmailNotifier', () => {
  function makeNotifier(): EmailNotifier {
    return new EmailNotifier({
      host: 'smtp.gmail.com',
      port: 465,
      user: 'sender@gmail.com',
      pass: 'app-password',
      to: 'recipient@example.com',
    });
  }

  it('sends email with correct text for appeared event', async () => {
    mockSendMail.mockClear();
    const notifier = makeNotifier();
    const event: FuelEvent = {
      stationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      stationName: STATION_NAME,
      fuelType: 'ai95',
      type: 'appeared',
      timestamp: TIMESTAMP,
    };
    await notifier.sendEvent(event);
    expect(mockSendMail).toHaveBeenCalledOnce();
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: `На АЗС ${STATION_NAME} появился бензин! Время: 09.09.2026 12:00:00`,
        subject: 'FindFuel: бензин появился',
        to: 'recipient@example.com',
        from: 'FindFuel <sender@gmail.com>',
      })
    );
  });

  it('sends email with correct text for disappeared event', async () => {
    mockSendMail.mockClear();
    const notifier = makeNotifier();
    const event: FuelEvent = {
      stationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      stationName: STATION_NAME,
      fuelType: 'ai95',
      type: 'disappeared',
      timestamp: new Date('2026-09-09T15:30:45'),
    };
    await notifier.sendEvent(event);
    expect(mockSendMail).toHaveBeenCalledOnce();
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: `На АЗС ${STATION_NAME} закончился бензин! Время: 09.09.2026 15:30:45`,
        subject: 'FindFuel: бензин закончился',
      })
    );
  });

  it('sends multiple events via sendEvents', async () => {
    mockSendMail.mockClear();
    const notifier = makeNotifier();
    const events: FuelEvent[] = [
      {
        stationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        stationName: 'АЗС 1',
        fuelType: 'ai95',
        type: 'appeared',
        timestamp: TIMESTAMP,
      },
      {
        stationId: 'a6c04e08-7c8f-4e2d-9b1a-3f5e7d9b1c2a',
        stationName: 'АЗС 2',
        fuelType: 'ai95',
        type: 'disappeared',
        timestamp: TIMESTAMP,
      },
    ];
    await notifier.sendEvents(events);
    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });
});
