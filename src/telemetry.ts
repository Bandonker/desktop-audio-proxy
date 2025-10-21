import { TelemetryOptions, TelemetryEvent } from './types';

export class TelemetryManager {
  private options: Required<TelemetryOptions>;
  private performanceMarks: Map<string, number> = new Map();

  constructor(options: TelemetryOptions = {}) {
    this.options = {
      enabled: options.enabled ?? false,
      onEvent: options.onEvent ?? (() => {}),
      trackPerformance: options.trackPerformance ?? true,
      trackErrors: options.trackErrors ?? true,
    };
  }

  public trackEvent(
    type: TelemetryEvent['type'],
    data?: Record<string, unknown>
  ): void {
    if (!this.options.enabled) return;

    const event: TelemetryEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    this.options.onEvent(event);
  }

  public startPerformanceTracking(label: string): void {
    if (!this.options.enabled || !this.options.trackPerformance) return;
    this.performanceMarks.set(label, Date.now());
  }

  public endPerformanceTracking(
    label: string,
    additionalData?: Record<string, unknown>
  ): number | null {
    if (!this.options.enabled || !this.options.trackPerformance) return null;

    const startTime = this.performanceMarks.get(label);
    if (!startTime) return null;

    const duration = Date.now() - startTime;
    this.performanceMarks.delete(label);

    this.trackEvent('performance', {
      label,
      duration,
      ...additionalData,
    });

    return duration;
  }

  public trackError(error: Error | string, context?: string): void {
    if (!this.options.enabled || !this.options.trackErrors) return;

    this.trackEvent('error', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      context,
    });
  }
}
