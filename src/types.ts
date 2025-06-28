
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

export interface AudioProxyOptions {
  proxyUrl?: string;
  autoDetect?: boolean;
  fallbackToOriginal?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  proxyConfig?: ProxyConfig;
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