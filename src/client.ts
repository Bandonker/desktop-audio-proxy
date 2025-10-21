import { AudioProxyOptions, StreamInfo, Environment } from './types';
import { TelemetryManager } from './telemetry';

// Type declarations for window objects
/* eslint-disable no-unused-vars */
declare global {
  interface Window {
    __TAURI__?: {
      // Tauri v1 API
      tauri?: {
        convertFileSrc: (filePath: string) => string;
        invoke?: (
          command: string,
          args?: Record<string, unknown>
        ) => Promise<unknown>;
      };
      // Tauri v2 API
      core?: {
        convertFileSrc: (filePath: string) => string;
        invoke?: (
          command: string,
          args?: Record<string, unknown>
        ) => Promise<unknown>;
      };
    };
    electronAPI?: unknown;
  }
}
/* eslint-enable no-unused-vars */

interface ProcessVersions {
  electron?: string;
  [key: string]: string | undefined;
}

declare const process:
  | {
      versions?: ProcessVersions;
    }
  | undefined;

/**
 * Main client for processing audio URLs and managing proxy connections.
 * Automatically detects environment (Tauri/Electron/Web) and handles URL conversion.
 *
 * @example
 * ```typescript
 * const client = new AudioProxyClient({
 *   autoStartProxy: true,
 *   fallbackToOriginal: true
 * });
 * const playableUrl = await client.getPlayableUrl('https://example.com/audio.mp3');
 * ```
 */
export class AudioProxyClient {
  private options: Required<AudioProxyOptions>;
  private environment: Environment;
  private autoStartedServer: unknown = null; // Server instance if auto-started
  private telemetry: TelemetryManager;

  /**
   * Creates a new AudioProxyClient instance.
   * @param options - Configuration options for the client
   */
  constructor(options: AudioProxyOptions = {}) {
    this.options = {
      proxyUrl: options.proxyUrl || 'http://localhost:3002',
      autoDetect: options.autoDetect ?? true,
      fallbackToOriginal: options.fallbackToOriginal ?? true,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      autoStartProxy: options.autoStartProxy ?? false,
      proxyServerConfig: options.proxyServerConfig || {},
      telemetry: options.telemetry || { enabled: false },
    };

    this.environment = this.detectEnvironment();
    this.telemetry = new TelemetryManager(this.options.telemetry);
  }

  private detectEnvironment(): Environment {
    if (typeof window === 'undefined') {
      return 'unknown';
    }

    // Check for Tauri v2 (window.__TAURI__.core) or Tauri v1 (window.__TAURI__.tauri)
    if (window.__TAURI__ && (window.__TAURI__.core || window.__TAURI__.tauri)) {
      return 'tauri';
    }

    if (
      window.electronAPI ||
      (typeof process !== 'undefined' &&
        process?.versions &&
        process.versions.electron)
    ) {
      return 'electron';
    }

    return 'web';
  }

  public getEnvironment(): Environment {
    return this.environment;
  }

  public getProxyUrl(): string {
    return this.options.proxyUrl;
  }

  private async startProxyServer(): Promise<boolean> {
    // Only works in Node.js environment
    if (typeof window !== 'undefined') {
      console.warn(
        '[AudioProxyClient] Cannot auto-start proxy server in browser environment'
      );
      return false;
    }

    try {
      // Dynamically import server-impl (only available in Node.js)
      const { startProxyServer } = await import('./server-impl');

      const url = new URL(this.options.proxyUrl);
      const port = parseInt(url.port) || 3002;

      console.log(
        `[AudioProxyClient] Auto-starting proxy server on port ${port}...`
      );

      this.autoStartedServer = await startProxyServer({
        port,
        ...this.options.proxyServerConfig,
      });

      // Wait a bit for server to fully start
      await this.delay(500);

      const available = await this.isProxyAvailable();
      if (available) {
        console.log(
          '[AudioProxyClient] Proxy server auto-started successfully'
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error(
        '[AudioProxyClient] Failed to auto-start proxy server:',
        error,
        '\nCommon causes: 1) Port already in use 2) Insufficient permissions 3) Not running in Node.js'
      );
      return false;
    }
  }

  public async isProxyAvailable(): Promise<boolean> {
    this.telemetry.startPerformanceTracking('proxy_check');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.options.proxyUrl}/health`, {
        signal: controller.signal,
        method: 'GET',
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('[AudioProxyClient] Proxy server available:', data);
        this.telemetry.endPerformanceTracking('proxy_check', { available: true });
        this.telemetry.trackEvent('proxy_check', { available: true, proxyUrl: this.options.proxyUrl });
        return true;
      }
      this.telemetry.endPerformanceTracking('proxy_check', { available: false });
      this.telemetry.trackEvent('proxy_check', { available: false, proxyUrl: this.options.proxyUrl });
      return false;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        '[AudioProxyClient] Proxy server unavailable:',
        errorMessage
      );
      this.telemetry.endPerformanceTracking('proxy_check', { available: false, error: errorMessage });
      this.telemetry.trackEvent('proxy_check', { available: false, proxyUrl: this.options.proxyUrl, error: errorMessage });
      return false;
    }
  }

  /**
   * Checks if a URL can be played and gets stream information.
   * @param url - The audio URL to check
   * @returns Promise resolving to stream information including playability
   */
  public async canPlayUrl(url: string): Promise<StreamInfo> {
    console.log('[AudioProxyClient] Processing URL:', url);

    // Check if it's a local file
    if (this.isLocalFile(url)) {
      console.log('[AudioProxyClient] Using local file handler');
      return {
        url,
        status: 200,
        headers: {},
        canPlay: true,
        requiresProxy: false,
      };
    }

    // Check if proxy is available
    const proxyAvailable = await this.isProxyAvailable();

    if (proxyAvailable) {
      try {
        const infoUrl = `${this.options.proxyUrl}/info?url=${encodeURIComponent(url)}`;
        const response = await fetch(infoUrl);

        if (response.ok) {
          const data = await response.json();
          const streamInfo: StreamInfo = {
            url: data.url,
            status: data.status,
            headers: data.headers || {},
            canPlay: true,
            requiresProxy: true,
            contentType: data.contentType,
            contentLength: data.contentLength,
            acceptRanges: data.acceptRanges,
            lastModified: data.lastModified,
          };
          console.log('[AudioProxyClient] Stream info:', streamInfo);
          return streamInfo;
        }
      } catch (error) {
        console.warn(
          '[AudioProxyClient] Failed to get stream info via proxy:',
          error
        );
      }
    }

    // Fallback: assume it needs proxy
    const streamInfo: StreamInfo = {
      url,
      status: 0,
      headers: {},
      canPlay: false,
      requiresProxy: true,
    };
    console.log('[AudioProxyClient] Stream info:', streamInfo);
    return streamInfo;
  }

  /**
   * Converts any audio URL to a playable URL, using proxy if needed.
   * This is the main method you'll use to process audio URLs.
   *
   * @param url - The original audio URL
   * @returns Promise resolving to a playable URL (may be proxied or converted)
   * @throws Error if proxy is unavailable and fallback is disabled
   *
   * @example
   * ```typescript
   * const playableUrl = await client.getPlayableUrl('https://example.com/audio.mp3');
   * audioElement.src = playableUrl;
   * ```
   */
  public async getPlayableUrl(url: string): Promise<string> {
    console.log('[AudioProxyClient] Processing URL:', url);
    this.telemetry.startPerformanceTracking('url_conversion');

    // Handle local files
    if (this.isLocalFile(url)) {
      console.log('[AudioProxyClient] Using local file handler');
      const result = this.handleLocalFile(url);
      this.telemetry.endPerformanceTracking('url_conversion', { url, type: 'local_file' });
      this.telemetry.trackEvent('url_conversion', { url, result, type: 'local_file', success: true });
      return result;
    }

    // Check stream info
    const streamInfo = await this.canPlayUrl(url);

    if (streamInfo.requiresProxy) {
      console.log(
        '[AudioProxyClient] Proxy required, checking availability...'
      );

      // Try proxy with retries
      for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
        let proxyAvailable = await this.isProxyAvailable();

        // If proxy not available and auto-start is enabled, try to start it
        if (
          !proxyAvailable &&
          this.options.autoStartProxy &&
          !this.autoStartedServer
        ) {
          console.log(
            '[AudioProxyClient] Attempting to auto-start proxy server...'
          );
          proxyAvailable = await this.startProxyServer();
        }

        if (proxyAvailable) {
          const result = `${this.options.proxyUrl}/proxy?url=${encodeURIComponent(url)}`;
          console.log('[AudioProxyClient] Generated proxy URL:', result);
          this.telemetry.endPerformanceTracking('url_conversion', { url, type: 'proxy', attempt });
          this.telemetry.trackEvent('url_conversion', { url, result, type: 'proxy', success: true, attempt });
          return result;
        }

        if (attempt < this.options.retryAttempts) {
          console.log(
            `[AudioProxyClient] Proxy not available on attempt ${attempt}`
          );
          await this.delay(this.options.retryDelay);
        }
      }

      // Proxy failed, fallback if enabled
      if (this.options.fallbackToOriginal) {
        console.log(
          '[AudioProxyClient] Falling back to original URL (may have CORS issues)'
        );
        this.telemetry.endPerformanceTracking('url_conversion', { url, type: 'fallback' });
        this.telemetry.trackEvent('url_conversion', { url, result: url, type: 'fallback', success: true });
        return url;
      } else {
        const error = new Error(
          `Proxy server unavailable at ${this.options.proxyUrl}. ` +
            `Tried ${this.options.retryAttempts} times. ` +
            `Solutions: 1) Start proxy server manually with 'startProxyServer()'. ` +
            `2) Enable 'autoStartProxy: true' option. ` +
            `3) Set 'fallbackToOriginal: true' to use direct URLs (may have CORS issues). ` +
            `4) Check if port ${new URL(this.options.proxyUrl).port} is blocked by firewall.`
        );
        this.telemetry.trackError(error, 'url_conversion');
        throw error;
      }
    }

    this.telemetry.endPerformanceTracking('url_conversion', { url, type: 'direct' });
    this.telemetry.trackEvent('url_conversion', { url, result: url, type: 'direct', success: true });
    return url;
  }

  private isLocalFile(url: string): boolean {
    return (
      url.startsWith('/') ||
      url.startsWith('./') ||
      url.startsWith('../') ||
      url.startsWith('file://') ||
      url.startsWith('blob:') ||
      url.startsWith('data:') ||
      !!url.match(/^[a-zA-Z]:\\/)
    ); // Windows path
  }

  private handleLocalFile(url: string): string {
    // Handle data: and blob: URLs directly - no conversion needed
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }

    // In Tauri, use convertFileSrc for file:// URLs
    if (this.environment === 'tauri' && window.__TAURI__) {
      try {
        // Try Tauri v2 API first (window.__TAURI__.core)
        let convertFileSrc = window.__TAURI__.core?.convertFileSrc;

        // Fallback to Tauri v1 API (window.__TAURI__.tauri)
        if (!convertFileSrc && window.__TAURI__.tauri) {
          convertFileSrc = window.__TAURI__.tauri.convertFileSrc;
        }

        if (
          convertFileSrc &&
          (url.startsWith('file://') ||
            url.startsWith('/') ||
            url.match(/^[a-zA-Z]:\\/))
        ) {
          return convertFileSrc(url);
        }
      } catch (error) {
        console.warn(
          '[AudioProxyClient] Failed to convert file source with Tauri:',
          error
        );
        // Fallback to original URL if conversion fails
      }
    }

    // For other environments or fallback, return as-is
    return url;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stops the auto-started proxy server if it was started by this client.
   * Automatically called on process exit, but can be called manually for cleanup.
   *
   * @example
   * ```typescript
   * await client.stopProxyServer();
   * ```
   */
  public async stopProxyServer(): Promise<void> {
    if (this.autoStartedServer) {
      try {
        console.log('[AudioProxyClient] Stopping auto-started proxy server...');
        const server = this.autoStartedServer as { stop: () => Promise<void> };
        await server.stop();
        this.autoStartedServer = null;
        console.log('[AudioProxyClient] Proxy server stopped successfully');
      } catch (error) {
        console.error('[AudioProxyClient] Failed to stop proxy server:', error);
      }
    }
  }
}

/**
 * Factory function to create an AudioProxyClient instance.
 * Convenient alternative to using `new AudioProxyClient()`.
 *
 * @param options - Configuration options for the client
 * @returns A new AudioProxyClient instance
 *
 * @example
 * ```typescript
 * const client = createAudioClient({
 *   autoStartProxy: true,
 *   proxyUrl: 'http://localhost:3002'
 * });
 * ```
 */
export function createAudioClient(
  options?: AudioProxyOptions
): AudioProxyClient {
  return new AudioProxyClient(options);
}
