export interface ProxyConfig {
  port?: number;
  host?: string;
  corsOrigins?: string | string[];
  timeout?: number;
  maxRedirects?: number;
  userAgent?: string;
  enableLogging?: boolean;
  enableTranscoding?: boolean;
  cacheEnabled?: boolean;
  cacheTTL?: number;
}

export interface TelemetryOptions {
  enabled?: boolean; // Enable telemetry tracking
  onEvent?: (event: TelemetryEvent) => void; // Custom event handler
  trackPerformance?: boolean; // Track performance metrics
  trackErrors?: boolean; // Track errors
}

export interface TelemetryEvent {
  type: 'proxy_start' | 'proxy_stop' | 'url_conversion' | 'error' | 'performance';
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface AudioProxyOptions {
  proxyUrl?: string;
  autoDetect?: boolean;
  fallbackToOriginal?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  autoStartProxy?: boolean; // Automatically start proxy server if not available (Node.js only)
  proxyServerConfig?: ProxyConfig; // Configuration for auto-started proxy server
  telemetry?: TelemetryOptions; // Optional telemetry for debugging and analytics
}

export interface StreamInfo {
  url: string;
  status: number;
  headers: Record<string, string>;
  canPlay: boolean;
  requiresProxy: boolean;
  contentType?: string;
  contentLength?: string;
  acceptRanges?: string;
  lastModified?: string;
}

export type Environment = 'tauri' | 'electron' | 'web' | 'unknown';

export interface AudioServiceOptions extends AudioProxyOptions {
  audioOptions?: AudioProxyOptions;
}
