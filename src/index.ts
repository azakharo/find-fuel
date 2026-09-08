import cron from 'node-cron';
import { loadConfig } from './config.js';
import { MemoryStateStore } from './state/memory-store.js';
import { EmailNotifier } from './notifications/email-notifier.js';
import { FuelMonitor } from './monitor/fuel-monitor.js';
import { fetchStations } from './api/sberazs-client.js';

async function main(): Promise<void> {
  const config = loadConfig();

  const db = new MemoryStateStore();
  const notifier = new EmailNotifier({
    host: config.smtpHost,
    port: config.smtpPort,
    user: config.smtpUser,
    pass: config.smtpPass,
    to: config.notificationEmail,
  });

  const monitor = new FuelMonitor(
    {
      stations: config.stations,
      fuelTypes: config.fuelTypes,
      plateType: config.plateType,
      timezone: config.timezone,
    },
    {
      fetcher: fetchStations,
      database: db,
      notifier,
    }
  );

  console.log(`FindFuel started. Cron: ${config.pollCron}, timezone: ${config.timezone}`);

  let hasFuelEvents = false;
  let apiError: string | undefined;
  try {
    const initialResult = await monitor.check();
    hasFuelEvents = initialResult.events.length > 0;
    if (initialResult.skipped) {
      console.log('Initial check skipped: not a matching day');
    } else if (initialResult.events.length > 0) {
      console.log(`Initial check events: ${initialResult.events.length}`);
    } else {
      console.log('Initial check: no changes');
    }
  } catch (e) {
    apiError = e instanceof Error ? e.message : String(e);
    console.error('Initial check failed:', e);
  }

  if (!hasFuelEvents) {
    try {
      await notifier.sendStartup(apiError !== undefined ? { apiError } : undefined);
      console.log('Startup notification sent');
    } catch (e) {
      console.error('Failed to send startup notification:', e);
    }
  }

  cron.schedule(config.pollCron, async () => {
    try {
      const result = await monitor.check();
      if (result.skipped) {
        console.log('Skipped: not a matching day');
      } else if (result.events.length > 0) {
        console.log(`Events: ${result.events.length}`);
      } else {
        console.log('No changes');
      }
    } catch (e) {
      console.error('Check failed:', e);
    }
  });
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
