/**
 * Comprehensive Debugger for Desktop Audio Proxy
 * Makes it easy to see what's happening under the hood
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory =
  | 'client'
  | 'server'
  | 'proxy'
  | 'environment'
  | 'performance'
  | 'network'
  | 'tauri'
  | 'electron';

export interface DebugOptions {
  enabled?: boolean;
  level?: LogLevel;
  categories?: LogCategory[];
  timestamp?: boolean;
  stackTrace?: boolean;
  onLog?: (_entry: DebugLogEntry) => void;
}

export interface DebugLogEntry {
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: unknown;
  stack?: string;
}

class AudioProxyDebugger {
  private options: Required<DebugOptions>;
  private logs: DebugLogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs

  constructor(options: DebugOptions = {}) {
    this.options = {
      enabled: options.enabled ?? false,
      level: options.level ?? 'info',
      categories: options.categories ?? [],
      timestamp: options.timestamp ?? true,
      stackTrace: options.stackTrace ?? false,
      onLog: options.onLog ?? (() => {}),
    };
  }

  public setEnabled(enabled: boolean): void {
    this.options.enabled = enabled;
  }

  public setLevel(level: LogLevel): void {
    this.options.level = level;
  }

  public setCategories(categories: LogCategory[]): void {
    this.options.categories = categories;
  }

  private shouldLog(level: LogLevel, category: LogCategory): boolean {
    if (!this.options.enabled) return false;

    // Check category filter
    if (
      this.options.categories.length > 0 &&
      !this.options.categories.includes(category)
    ) {
      return false;
    }

    // Check log level
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.options.level);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  public debug(category: LogCategory, message: string, data?: unknown): void {
    this.log('debug', category, message, data);
  }

  public info(category: LogCategory, message: string, data?: unknown): void {
    this.log('info', category, message, data);
  }

  public warn(category: LogCategory, message: string, data?: unknown): void {
    this.log('warn', category, message, data);
  }

  public error(category: LogCategory, message: string, data?: unknown): void {
    this.log('error', category, message, data);
  }

  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: unknown
  ): void {
    if (!this.shouldLog(level, category)) return;

    const entry: DebugLogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      stack: this.options.stackTrace ? new Error().stack : undefined,
    };

    // Store in memory
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Call custom handler
    this.options.onLog(entry);

    // Console output
    this.logToConsole(entry);
  }

  private logToConsole(entry: DebugLogEntry): void {
    const timestamp = this.options.timestamp
      ? `[${new Date(entry.timestamp).toISOString()}]`
      : '';
    const prefix = `${timestamp} [${entry.category.toUpperCase()}]`;
    const message = `${prefix} ${entry.message}`;

    const consoleMethod =
      entry.level === 'error'
        ? 'error'
        : entry.level === 'warn'
          ? 'warn'
          : entry.level === 'debug'
            ? 'debug'
            : 'log';

    if (entry.data !== undefined) {
      console[consoleMethod](message, entry.data);
    } else {
      console[consoleMethod](message);
    }

    if (entry.stack && entry.level === 'error') {
      console.error('Stack trace:', entry.stack);
    }
  }

  public getLogs(filter?: {
    level?: LogLevel;
    category?: LogCategory;
    since?: number;
  }): DebugLogEntry[] {
    let filtered = this.logs;

    if (filter?.level) {
      filtered = filtered.filter(log => log.level === filter.level);
    }

    if (filter?.category) {
      filtered = filtered.filter(log => log.category === filter.category);
    }

    if (filter?.since !== undefined) {
      filtered = filtered.filter(log => log.timestamp >= filter.since!);
    }

    return filtered;
  }

  public clearLogs(): void {
    this.logs = [];
  }

  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  public getStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    byCategory: Record<LogCategory, number>;
  } {
    const byLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
    };

    const byCategory: Record<LogCategory, number> = {
      client: 0,
      server: 0,
      proxy: 0,
      environment: 0,
      performance: 0,
      network: 0,
      tauri: 0,
      electron: 0,
    };

    this.logs.forEach(log => {
      byLevel[log.level]++;
      byCategory[log.category]++;
    });

    return {
      total: this.logs.length,
      byLevel,
      byCategory,
    };
  }

  public printStats(): void {
    const stats = this.getStats();
    console.log('=== Desktop Audio Proxy Debug Stats ===');
    console.log(`Total Logs: ${stats.total}`);
    console.log('\nBy Level:');
    Object.entries(stats.byLevel).forEach(([level, count]) => {
      if (count > 0) {
        console.log(`  ${level}: ${count}`);
      }
    });
    console.log('\nBy Category:');
    Object.entries(stats.byCategory).forEach(([category, count]) => {
      if (count > 0) {
        console.log(`  ${category}: ${count}`);
      }
    });
  }
}

// Global singleton instance
let globalDebugger: AudioProxyDebugger | null = null;

export function getDebugger(options?: DebugOptions): AudioProxyDebugger {
  if (!globalDebugger) {
    globalDebugger = new AudioProxyDebugger(options);
  } else if (options) {
    // Update options if provided
    if (options.enabled !== undefined)
      globalDebugger.setEnabled(options.enabled);
    if (options.level) globalDebugger.setLevel(options.level);
    if (options.categories) globalDebugger.setCategories(options.categories);
  }
  return globalDebugger;
}

export function enableDebug(
  level: LogLevel = 'debug',
  categories?: LogCategory[]
): AudioProxyDebugger {
  const debug = getDebugger({
    enabled: true,
    level,
    categories,
    timestamp: true,
  });
  console.log('[DebugMode] Desktop Audio Proxy debugging enabled');
  console.log(`[DebugMode] Log level: ${level}`);
  if (categories) {
    console.log(`[DebugMode] Categories: ${categories.join(', ')}`);
  } else {
    console.log('[DebugMode] Categories: all');
  }
  return debug;
}

export function disableDebug(): void {
  const debug = getDebugger();
  debug.setEnabled(false);
  console.log('[DebugMode] Desktop Audio Proxy debugging disabled');
}

// Export the class for advanced users
export { AudioProxyDebugger };
