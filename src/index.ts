import cron from 'node-cron';
import { loadConfig } from './config.js';
import { FuelDatabase } from './db/database.js';
import { EmailNotifier } from './notifications/email-notifier.js';
import { FuelMonitor } from './monitor/fuel-monitor.js';
import { fetchStations } from './api/sberazs-client.js';

async function main(): Promise<void> {
  const config = loadConfig();

  const db = new FuelDatabase('data/findfuel.db');
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
