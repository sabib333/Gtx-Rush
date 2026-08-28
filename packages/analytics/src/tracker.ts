import type { AnalyticsEventName, AnalyticsEvent } from '@gtx-rush/types';

/**
 * Analytics tracker interface.
 * Server-side implementation sends events to the database.
 * Client-side implementation batches and sends to the API.
 */

export interface AnalyticsTracker {
  /** Track a single event */
  track(
    eventName: AnalyticsEventName,
    properties: Record<string, unknown>,
    userId?: string
  ): void;

  /** Flush any buffered events */
  flush(): Promise<void>;

  /** Set default properties for all events (e.g., userId, sessionId) */
  setDefaultProperties(props: Record<string, unknown>): void;
}

/**
 * In-memory tracker for development and testing.
 * In production, replace with a database-backed implementation.
 */
export class InMemoryTracker implements AnalyticsTracker {
  private events: AnalyticsEvent[] = [];
  private defaultProperties: Record<string, unknown> = {};

  track(
    eventName: AnalyticsEventName,
    properties: Record<string, unknown>,
    userId?: string
  ): void {
    this.events.push({
      eventName,
      userId: userId ?? (this.defaultProperties['userId'] as string) ?? null,
      properties: {
        ...this.defaultProperties,
        ...properties,
      },
      sessionId: (this.defaultProperties['sessionId'] as string) ?? 'unknown',
      timestamp: new Date(),
    });
  }

  async flush(): Promise<void> {
    // In production: batch insert into analytics_events table
    console.log(`[Analytics] Flushing ${this.events.length} events`);
    this.events = [];
  }

  setDefaultProperties(props: Record<string, unknown>): void {
    this.defaultProperties = { ...this.defaultProperties, ...props };
  }

  /** Get all tracked events (for testing) */
  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }
}
