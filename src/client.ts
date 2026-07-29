import {
  AudioProxyOptions,
  StreamInfo,
  Environment,
  ProxyConfig,
} from './types';
import { TelemetryManager } from './telemetry';

const DEFAULT_PROXY_URL = 'http://localhost:3002';
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const PROXY_HEALTH_TIMEOUT_MS = 5000;
const SERVER_PACKAGE_ENTRY = 'desktop-audio-proxy/server';

interface AutoStartedProxyServer {
  stop: () => Promise<void>;
  getProxyUrl?: () => string;
}

type StartProxyServerFn = (
  config?: ProxyConfig
) => Promise<AutoStartedProxyServer>;

const WINDOWS_PATH_REGEX = /^[a-zA-Z]:\\/;
const WINDOWS_UNC_PATH_REGEX = /^\\\\[^\\]+\\/;

function normalizeProxyUrl(proxyUrl: string): string {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(proxyUrl);
  } catch {
    throw new TypeError('proxyUrl must be an absolute HTTP URL');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new TypeError('proxyUrl must use the http or https protocol');
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new TypeError('proxyUrl must not contain credentials');
  }

  if (
    (parsedUrl.pathname && parsedUrl.pathname !== '/') ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new TypeError('proxyUrl must contain only an origin');
  }

  return parsedUrl.origin;
}

function sanitizeUrlForDiagnostics(url: string): string {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return `[${parsedUrl.protocol.slice(0, -1) || 'local'} URL]`;
    }
    parsedUrl.username = '';
    parsedUrl.password = '';
    parsedUrl.hash = '';
    parsedUrl.search = '';
    parsedUrl.pathname = parsedUrl.pathname === '/' ? '/' : '/[redacted-path]';
    return parsedUrl.toString();
  } catch {
    return '[local or invalid URL]';
  }
}

// Type declarations for window objects
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
  private autoStartedServer: AutoStartedProxyServer | null = null;
  private autoStartPromise: Promise<boolean> | null = null;
  private telemetry: TelemetryManager;

  /**
   * Creates a new AudioProxyClient instance.
   * @param options - Configuration options for the client
   */
  constructor(options: AudioProxyOptions = {}) {
    const retryAttempts = options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
    const retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY_MS;

    if (!Number.isInteger(retryAttempts) || retryAttempts < 1) {
      throw new RangeError('retryAttempts must be a positive integer');
    }
    if (!Number.isFinite(retryDelay) || retryDelay < 0) {
      throw new RangeError('retryDelay must be a non-negative number');
    }

    this.options = {
      proxyUrl: normalizeProxyUrl(options.proxyUrl ?? DEFAULT_PROXY_URL),
      autoDetect: options.autoDetect ?? true,
      fallbackToOriginal: options.fallbackToOriginal ?? true,
      retryAttempts,
      retryDelay,
      autoStartProxy: options.autoStartProxy ?? false,
      proxyServerConfig: options.proxyServerConfig ?? {},
      telemetry: options.telemetry ?? { enabled: false },
    };

    this.environment = this.options.autoDetect
      ? this.detectEnvironment()
      : 'unknown';
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
    if (this.autoStartPromise) {
      return this.autoStartPromise;
    }

    const startOperation = this.startProxyServerInternal();
    this.autoStartPromise = startOperation;

    try {
      return await startOperation;
    } finally {
      if (this.autoStartPromise === startOperation) {
        this.autoStartPromise = null;
      }
    }
  }

  private async startProxyServerInternal(): Promise<boolean> {
    // Only works in Node.js environment
    if (typeof window !== 'undefined') {
      console.warn(
        '[AudioProxyClient] Cannot auto-start proxy server in browser environment'
      );
      return false;
    }

    try {
      // Keep the module path indirect so browser-targeted bundles do not pull in
      // Node-only server dependencies. Package self-resolution works from both
      // the ESM and CommonJS main builds.
      const dynamicImport = (modulePath: string) =>
        import(modulePath) as Promise<{
          startProxyServer?: StartProxyServerFn;
        }>;
      const serverModule = await dynamicImport(SERVER_PACKAGE_ENTRY);

      if (typeof serverModule.startProxyServer !== 'function') {
        throw new Error('startProxyServer export not found in server module');
      }
      const startProxyServer = serverModule.startProxyServer;

      const url = new URL(this.options.proxyUrl);
      if (url.protocol !== 'http:') {
        throw new Error('Auto-start requires an http:// proxyUrl');
      }
      const port = Number.parseInt(url.port, 10) || 80;
      const urlHostname =
        url.hostname.startsWith('[') && url.hostname.endsWith(']')
          ? url.hostname.slice(1, -1)
          : url.hostname;
      const configuredHost = this.options.proxyServerConfig.host ?? urlHostname;
      const configuredPort = this.options.proxyServerConfig.port ?? port;

      console.log(
        `[AudioProxyClient] Auto-starting proxy server on port ${configuredPort}...`
      );

      this.autoStartedServer = await startProxyServer({
        ...this.options.proxyServerConfig,
        host: configuredHost,
        port: configuredPort,
      });

      const runtimeProxyUrl = this.autoStartedServer.getProxyUrl?.();
      if (runtimeProxyUrl) {
        this.options.proxyUrl = normalizeProxyUrl(runtimeProxyUrl);
      }

      const available = await this.isProxyAvailable();
      if (available) {
        console.log(
          '[AudioProxyClient] Proxy server auto-started successfully'
        );
        this.telemetry.trackEvent('proxy_start', {
          proxyUrl: this.options.proxyUrl,
        });
        return true;
      }

      await this.autoStartedServer.stop();
      this.autoStartedServer = null;
      return false;
    } catch (error) {
      if (this.autoStartedServer) {
        try {
          await this.autoStartedServer.stop();
        } catch {
          // The original startup failure is the actionable error.
        }
        this.autoStartedServer = null;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `[AudioProxyClient] Failed to auto-start proxy server: ${errorMessage}`,
        '\nCommon causes: 1) Port already in use 2) Insufficient permissions 3) Not running in Node.js'
      );
      return false;
    }
  }

  public async isProxyAvailable(): Promise<boolean> {
    this.telemetry.startPerformanceTracking('proxy_check');
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      PROXY_HEALTH_TIMEOUT_MS
    );

    try {
      const response = await fetch(`${this.options.proxyUrl}/health`, {
        signal: controller.signal,
        method: 'GET',
        cache: 'no-cache',
      });

      if (response.ok) {
        const data = await response.json();
        const isAudioProxy =
          data !== null &&
          typeof data === 'object' &&
          (data as { status?: unknown }).status === 'ok';
        if (isAudioProxy) {
          console.log('[AudioProxyClient] Proxy server available');
          this.trackProxyCheck(true);
          return true;
        }
      }
      this.trackProxyCheck(false);
      return false;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        '[AudioProxyClient] Proxy server unavailable:',
        errorMessage
      );
      this.trackProxyCheck(false, errorMessage);
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private trackProxyCheck(available: boolean, error?: string): void {
    this.telemetry.endPerformanceTracking('proxy_check', {
      available,
      ...(error ? { error } : {}),
    });
    this.telemetry.trackEvent('proxy_check', {
      available,
      proxyUrl: this.options.proxyUrl,
      ...(error ? { error } : {}),
    });
  }

  /**
   * Checks if a URL can be played and gets stream information.
   * @param url - The audio URL to check
   * @returns Promise resolving to stream information including playability
   */
  public async canPlayUrl(url: string): Promise<StreamInfo> {
    this.validateMediaUrl(url);
    console.log('[AudioProxyClient] Processing media URL');

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
          console.log('[AudioProxyClient] Stream info received');
          return streamInfo;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.warn(
          `[AudioProxyClient] Failed to get stream info via proxy: ${errorMessage}`
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
    console.log('[AudioProxyClient] Stream info unavailable');
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
    this.validateMediaUrl(url);
    console.log('[AudioProxyClient] Processing media URL');
    this.telemetry.startPerformanceTracking('url_conversion');

    // Handle local files
    if (this.isLocalFile(url)) {
      console.log('[AudioProxyClient] Using local file handler');
      const result = this.handleLocalFile(url);
      this.telemetry.endPerformanceTracking('url_conversion', {
        url: sanitizeUrlForDiagnostics(url),
        type: 'local_file',
      });
      this.telemetry.trackEvent('url_conversion', {
        url: sanitizeUrlForDiagnostics(url),
        result: sanitizeUrlForDiagnostics(result),
        type: 'local_file',
        success: true,
      });
      return result;
    }

    console.log('[AudioProxyClient] Proxy required, checking availability...');

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
        console.log('[AudioProxyClient] Generated proxy URL');
        this.telemetry.endPerformanceTracking('url_conversion', {
          url: sanitizeUrlForDiagnostics(url),
          type: 'proxy',
          attempt,
        });
        this.telemetry.trackEvent('url_conversion', {
          url: sanitizeUrlForDiagnostics(url),
          result: sanitizeUrlForDiagnostics(result),
          type: 'proxy',
          success: true,
          attempt,
        });
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
      this.telemetry.endPerformanceTracking('url_conversion', {
        url: sanitizeUrlForDiagnostics(url),
        type: 'fallback',
      });
      this.telemetry.trackEvent('url_conversion', {
        url: sanitizeUrlForDiagnostics(url),
        result: sanitizeUrlForDiagnostics(url),
        type: 'fallback',
        success: true,
      });
      return url;
    }

    const proxyPort = new URL(this.options.proxyUrl).port || '80';
    const error = new Error(
      `Proxy server unavailable at ${this.options.proxyUrl}. ` +
        `Tried ${this.options.retryAttempts} times. ` +
        `Solutions: 1) Start proxy server manually with 'startProxyServer()'. ` +
        `2) Enable 'autoStartProxy: true' option. ` +
        `3) Set 'fallbackToOriginal: true' to use direct URLs (may have CORS issues). ` +
        `4) Check if port ${proxyPort} is blocked by firewall.`
    );
    this.telemetry.trackError(error, 'url_conversion');
    throw error;
  }

  private isLocalFile(url: string): boolean {
    return (
      (url.startsWith('/') && !url.startsWith('//')) ||
      url.startsWith('./') ||
      url.startsWith('../') ||
      url.startsWith('file://') ||
      url.startsWith('blob:') ||
      url.startsWith('data:') ||
      WINDOWS_PATH_REGEX.test(url) ||
      WINDOWS_UNC_PATH_REGEX.test(url)
    ); // Windows path
  }

  private validateMediaUrl(url: string): void {
    if (!url.trim()) {
      throw new TypeError('Media URL must not be empty');
    }

    if (this.isLocalFile(url)) {
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new TypeError(
        'Media URL must be an absolute HTTP URL or a supported local path'
      );
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new TypeError('Remote media URLs must use http or https');
    }

    if (parsedUrl.username || parsedUrl.password) {
      throw new TypeError('Media URLs must not contain credentials');
    }
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
            WINDOWS_PATH_REGEX.test(url))
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
   * Call this during application shutdown to release the listening socket.
   *
   * @example
   * ```typescript
   * await client.stopProxyServer();
   * ```
   */
  public async stopProxyServer(): Promise<void> {
    if (this.autoStartPromise) {
      await this.autoStartPromise;
    }

    const server = this.autoStartedServer;
    this.autoStartedServer = null;

    if (server) {
      try {
        console.log('[AudioProxyClient] Stopping auto-started proxy server...');
        await server.stop();
        this.telemetry.trackEvent('proxy_stop', {
          proxyUrl: this.options.proxyUrl,
        });
        console.log('[AudioProxyClient] Proxy server stopped successfully');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `[AudioProxyClient] Failed to stop proxy server: ${errorMessage}`
        );
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
