import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { format } from 'date-fns';
import type { FuelEvent } from '../types.js';

export interface EmailNotifierConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  to: string;
  from?: string;
}

export interface EventSender {
  sendEvents(events: FuelEvent[]): Promise<void>;
}

export function formatEventMessage(event: FuelEvent): { subject: string; text: string } {
  const time = format(event.timestamp, 'dd.MM.yyyy HH:mm:ss');
  if (event.type === 'appeared') {
    return {
      subject: 'FindFuel: бензин появился',
      text: `На АЗС ${event.stationName} появился бензин! Время: ${time}`,
    };
  }
  return {
    subject: 'FindFuel: бензин закончился',
    text: `На АЗС ${event.stationName} закончился бензин! Время: ${time}`,
  };
}

export class EmailNotifier implements EventSender {
  private transporter: Transporter;
  private to: string;
  private from: string;

  constructor(config: EmailNotifierConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
    this.to = config.to;
    this.from = config.from ?? `FindFuel <${config.user}>`;
  }

  async sendEvent(event: FuelEvent): Promise<void> {
    const { subject, text } = formatEventMessage(event);
    await this.transporter.sendMail({
      from: this.from,
      to: this.to,
      subject,
      text,
    });
  }

  async sendEvents(events: FuelEvent[]): Promise<void> {
    for (const event of events) {
      await this.sendEvent(event);
    }
  }

  async verifyConnection(): Promise<void> {
    await this.transporter.verify();
  }
}
