import { AudioProxyOptions, StreamInfo, Environment } from './types';

// Type declarations for window objects
declare global {
  interface Window {
    __TAURI__?: {
      tauri: {
        convertFileSrc: (_filePath: string) => string;
        invoke?: (
          _command: string,
          _args?: Record<string, unknown>
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

export class AudioProxyClient {
  private options: Required<AudioProxyOptions>;
  private environment: Environment;

  constructor(options: AudioProxyOptions = {}) {
    this.options = {
      proxyUrl: options.proxyUrl || 'http://localhost:3002',
      autoDetect: options.autoDetect ?? true,
      fallbackToOriginal: options.fallbackToOriginal ?? true,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      proxyConfig: options.proxyConfig || {},
    };

    this.environment = this.detectEnvironment();
  }

  private detectEnvironment(): Environment {
    if (typeof window === 'undefined') {
      return 'unknown';
    }

    if (window.__TAURI__) {
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

  public async isProxyAvailable(): Promise<boolean> {
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
        return true;
      }
      return false;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        '[AudioProxyClient] Proxy server unavailable:',
        errorMessage
      );
      return false;
    }
  }

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

  public async getPlayableUrl(url: string): Promise<string> {
    console.log('[AudioProxyClient] Processing URL:', url);

    // Handle local files
    if (this.isLocalFile(url)) {
      console.log('[AudioProxyClient] Using local file handler');
      return this.handleLocalFile(url);
    }

    // Check stream info
    const streamInfo = await this.canPlayUrl(url);

    if (streamInfo.requiresProxy) {
      console.log(
        '[AudioProxyClient] Proxy required, checking availability...'
      );

      // Try proxy with retries
      for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
        const proxyAvailable = await this.isProxyAvailable();

        if (proxyAvailable) {
          console.log(
            '[AudioProxyClient] Generated proxy URL:',
            `${this.options.proxyUrl}/proxy?url=${encodeURIComponent(url)}`
          );
          return `${this.options.proxyUrl}/proxy?url=${encodeURIComponent(url)}`;
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
        return url;
      } else {
        throw new Error('Proxy server unavailable and fallback disabled');
      }
    }

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
        const { convertFileSrc } = window.__TAURI__.tauri;
        if (
          url.startsWith('file://') ||
          url.startsWith('/') ||
          url.match(/^[a-zA-Z]:\\/)
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
}

export function createAudioClient(
  options?: AudioProxyOptions
): AudioProxyClient {
  return new AudioProxyClient(options);
}
