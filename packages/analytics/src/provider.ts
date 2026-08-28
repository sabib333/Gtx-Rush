/**
 * Analytics provider abstraction.
 * Actual analytics provider (PostHog, Mixpanel, etc.) is plugged in later.
 * This interface allows swapping providers without changing business logic.
 */

export interface AnalyticsProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  identify(userId: string, traits?: Record<string, unknown>): Promise<void>;
  track(userId: string | null, event: string, properties?: Record<string, unknown>): Promise<void>;
  flush(): Promise<void>;
}

/**
 * No-op provider for development.
 */
export class NoOpAnalyticsProvider implements AnalyticsProvider {
  name = 'noop';

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async identify(): Promise<void> {
    // No-op
  }

  async track(): Promise<void> {
    // No-op
  }

  async flush(): Promise<void> {
    // No-op
  }
}
