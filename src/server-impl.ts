import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import axios, { AxiosResponse } from 'axios';
import { Readable } from 'stream';
import { createServer } from 'net';
import { Server as HttpServer } from 'http';
import { ProxyConfig } from './types';

const DEFAULT_PORT = 3002;
const DEFAULT_HOST = 'localhost';
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_MAX_REDIRECTS = 10;
const DEFAULT_USER_AGENT = 'AudioProxy/1.0';
const DEFAULT_CACHE_TTL = 3600;
const DEFAULT_ACCEPT_HEADER = 'audio/*,*/*;q=0.1';
const DEFAULT_ACCEPT_LANGUAGE_HEADER = 'en-US,en;q=0.9';

const CORS_EXPOSED_HEADERS = [
  'Content-Length',
  'Content-Range',
  'Accept-Ranges',
];
const CORS_ALLOWED_METHODS = ['GET', 'OPTIONS', 'HEAD'];
const CORS_ALLOWED_HEADERS = ['Content-Type', 'Range', 'Accept-Encoding'];

const PROXIED_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'cache-control',
  'expires',
  'last-modified',
  'etag',
];

type ErrorContext = 'info' | 'proxy';

interface NormalizedError {
  status: number;
  body: {
    error: string;
    message?: string;
    url: string;
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function getProcessUptime(): number {
  const runtime = globalThis as unknown as {
    process?: { uptime?: () => number };
  };

  return runtime.process?.uptime ? runtime.process.uptime() : 0;
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === 'string' ? maybeCode : undefined;
}

// Utility function to check if a port is available
async function isPortAvailable(
  port: number,
  host: string = 'localhost'
): Promise<boolean> {
  return new Promise(resolve => {
    const server = createServer();

    server.listen(port, host, () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.on('error', () => {
      resolve(false);
    });
  });
}

// Find the next available port starting from the given port
async function findAvailablePort(
  startPort: number,
  host: string = 'localhost',
  maxAttempts: number = 10
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await isPortAvailable(port, host);
    if (available) {
      return port;
    }
  }
  throw new Error(
    `No available port found in range ${startPort}-${startPort + maxAttempts - 1}`
  );
}

export class AudioProxyServer {
  private app: express.Application;
  private server: HttpServer | null = null;
  private config: Required<ProxyConfig>;
  private actualPort: number = 0;

  constructor(config: ProxyConfig = {}) {
    this.config = {
      port: config.port || DEFAULT_PORT,
      host: config.host || DEFAULT_HOST,
      corsOrigins: config.corsOrigins || '*',
      timeout: config.timeout || DEFAULT_TIMEOUT,
      maxRedirects: config.maxRedirects || DEFAULT_MAX_REDIRECTS,
      userAgent: config.userAgent || DEFAULT_USER_AGENT,
      enableLogging: config.enableLogging ?? true,
      enableTranscoding: config.enableTranscoding ?? false,
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTL: config.cacheTTL || DEFAULT_CACHE_TTL,
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS middleware
    this.app.use(
      cors({
        origin: this.config.corsOrigins,
        credentials: true,
        exposedHeaders: CORS_EXPOSED_HEADERS,
        methods: CORS_ALLOWED_METHODS,
        allowedHeaders: CORS_ALLOWED_HEADERS,
      })
    );

    // Logging middleware
    if (this.config.enableLogging) {
      this.app.use((req: Request, _res: Response, next: NextFunction) => {
        console.log(`[AudioProxy] ${req.method} ${req.path}`);
        next();
      });
    }
  }

  private setupRoutes(): void {
    // Handle CORS preflight for all routes
    this.app.options('*', (_req: Request, res: Response) => {
      res.set({
        'Access-Control-Allow-Origin': this.config.corsOrigins,
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Range, Accept-Encoding, User-Agent',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400', // 24 hours
      });
      res.status(204).end();
    });

    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        version: '1.1.7',
        uptime: getProcessUptime(),
        config: {
          port: this.actualPort || this.config.port,
          configuredPort: this.config.port,
          enableTranscoding: this.config.enableTranscoding,
          cacheEnabled: this.config.cacheEnabled,
        },
      });
    });

    // Info endpoint
    this.app.get('/info', async (req: Request, res: Response) => {
      const url = this.getRequestUrl(req);
      if (!url) {
        return res.status(400).json({ error: 'URL parameter required' });
      }

      try {
        // Get stream info without downloading
        const response = await axios({
          method: 'HEAD',
          url: url,
          headers: {
            'User-Agent': this.config.userAgent,
            Accept: DEFAULT_ACCEPT_HEADER,
          },
          timeout: this.config.timeout,
          maxRedirects: this.config.maxRedirects,
          validateStatus: (status: number) => status < 400,
        });

        return res.json({
          url,
          status: response.status,
          headers: response.headers,
          contentType: response.headers['content-type'],
          contentLength: response.headers['content-length'],
          acceptRanges: response.headers['accept-ranges'],
          lastModified: response.headers['last-modified'],
        });
      } catch (error: unknown) {
        console.error('[AudioProxy] Info error:', error);
        const normalizedError = this.normalizeRequestError(error, url, 'info');
        return res.status(normalizedError.status).json(normalizedError.body);
      }
    });

    // Proxy endpoint
    this.app.get('/proxy', async (req: Request, res: Response) => {
      const url = this.getRequestUrl(req);
      if (!url) {
        return res.status(400).json({ error: 'URL parameter required' });
      }

      try {
        // Set CORS headers immediately
        res.set({
          'Access-Control-Allow-Origin': this.config.corsOrigins,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Expose-Headers':
            'Content-Length, Content-Range, Accept-Ranges',
          'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
          'Access-Control-Allow-Headers':
            'Content-Type, Range, Accept-Encoding',
        });

        // Prepare request headers
        const requestHeaders: Record<string, string> = {
          'User-Agent': this.config.userAgent,
          Accept: req.headers.accept || DEFAULT_ACCEPT_HEADER,
          'Accept-Language':
            req.headers['accept-language'] || DEFAULT_ACCEPT_LANGUAGE_HEADER,
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        };

        const requestAbortController = new AbortController();

        // Handle range requests for seeking support
        if (req.headers.range) {
          requestHeaders['Range'] = req.headers.range;
        }

        // Handle encoding
        if (req.headers['accept-encoding']) {
          requestHeaders['Accept-Encoding'] = req.headers['accept-encoding'];
        }

        // Use axios for better stream handling
        const response: AxiosResponse = await axios({
          method: 'GET',
          url: url,
          headers: requestHeaders,
          responseType: 'stream',
          timeout: this.config.timeout,
          maxRedirects: this.config.maxRedirects,
          validateStatus: (status: number) => status < 400, // Accept redirects and success codes
          signal: requestAbortController.signal,
        });

        // Set response status
        res.status(response.status);

        // Copy relevant headers from the original response
        PROXIED_RESPONSE_HEADERS.forEach(header => {
          const value = response.headers[header];
          if (value) {
            res.set(header, value);
          }
        });

        const stream = response.data as Readable;
        let cleanedUp = false;

        const cleanup = (destroyStream: boolean): void => {
          if (cleanedUp) {
            return;
          }

          cleanedUp = true;
          requestAbortController.abort();

          req.removeListener('aborted', handleRequestAborted);
          res.removeListener('close', handleResponseClose);
          res.removeListener('error', handleResponseError);
          res.removeListener('finish', handleResponseFinish);
          stream.removeListener('error', handleStreamError);

          if (destroyStream && !stream.destroyed) {
            stream.destroy();
          }
        };

        const handleRequestAborted = () => {
          cleanup(true);
        };

        const handleResponseClose = () => {
          cleanup(true);
        };

        const handleResponseFinish = () => {
          cleanup(false);
        };

        const handleResponseError = (error: Error) => {
          console.error('[AudioProxy] Response error:', error);
          cleanup(true);
        };

        const handleStreamError = (error: Error) => {
          console.error('[AudioProxy] Stream error:', error);
          if (this.canSendJsonResponse(res)) {
            res.status(500).json({
              error: 'Stream error',
              message: error.message,
            });
          } else if (!res.writableEnded) {
            res.end();
          }
          cleanup(true);
        };

        stream.once('error', handleStreamError);
        req.once('aborted', handleRequestAborted);
        res.once('close', handleResponseClose);
        res.once('error', handleResponseError);
        res.once('finish', handleResponseFinish);

        // Pipe the stream to response
        stream.pipe(res);
        // Return void to satisfy TypeScript strict mode
        return;
      } catch (error: unknown) {
        console.error('[AudioProxy] Proxy error:', error);

        if (this.canSendJsonResponse(res)) {
          const normalizedError = this.normalizeRequestError(
            error,
            url,
            'proxy'
          );
          return res.status(normalizedError.status).json(normalizedError.body);
        }
        // If headers were already sent, just return
        return;
      }
    });
  }

  private canSendJsonResponse(res: Response): boolean {
    return !res.headersSent && !res.writableEnded;
  }

  private getRequestUrl(req: Request): string | null {
    if (typeof req.query.url !== 'string') {
      return null;
    }

    const normalizedUrl = req.query.url.trim();
    return normalizedUrl.length > 0 ? normalizedUrl : null;
  }

  private normalizeRequestError(
    error: unknown,
    url: string,
    context: ErrorContext
  ): NormalizedError {
    const fallbackError =
      context === 'info' ? 'Failed to get stream info' : 'Proxy request failed';

    const axiosError = axios.isAxiosError(error)
      ? (error as {
          response?: { status: number; statusText: string };
          code?: string;
        })
      : undefined;

    if (axiosError?.response) {
      return {
        status: axiosError.response.status,
        body: {
          error: `Upstream error: ${axiosError.response.status} ${axiosError.response.statusText}`,
          url,
        },
      };
    }

    const axiosErrorCode =
      axiosError && typeof axiosError.code === 'string'
        ? axiosError.code
        : undefined;
    const errorCode = getErrorCode(error) || axiosErrorCode;

    if (errorCode === 'ENOTFOUND') {
      return {
        status: 404,
        body: {
          error: 'Audio source not found',
          message: 'Unable to resolve hostname',
          url,
        },
      };
    }

    if (errorCode === 'ECONNREFUSED') {
      return {
        status: 503,
        body: {
          error: 'Audio source unavailable',
          message: 'Connection refused',
          url,
        },
      };
    }

    if (errorCode === 'ETIMEDOUT' || errorCode === 'ECONNABORTED') {
      return {
        status: 408,
        body: {
          error: 'Request timeout',
          message: 'Audio source did not respond in time',
          url,
        },
      };
    }

    return {
      status: 500,
      body: {
        error: fallbackError,
        message: getErrorMessage(error),
        url,
      },
    };
  }

  public async start(): Promise<void> {
    try {
      // Find an available port starting from the configured port
      this.actualPort = await findAvailablePort(
        this.config.port,
        this.config.host
      );

      return new Promise((resolve, reject) => {
        this.server = this.app.listen(this.actualPort, this.config.host, () => {
          if (this.actualPort !== this.config.port) {
            console.log(
              `⚠️  Port ${this.config.port} was occupied, using port ${this.actualPort} instead`
            );
          }
          console.log(
            `Desktop Audio Proxy running on http://${this.config.host}:${this.actualPort}`
          );
          console.log(
            `Use http://${this.config.host}:${this.actualPort}/proxy?url=YOUR_AUDIO_URL`
          );
          resolve();
        });

        this.server.on('error', (error: Error) => {
          reject(error);
        });
      });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      throw new Error(`Failed to start proxy server: ${errorMessage}`);
    }
  }

  public async stop(): Promise<void> {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => {
          console.log('Desktop Audio Proxy stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getActualPort(): number {
    return this.actualPort || this.config.port;
  }

  public getProxyUrl(): string {
    return `http://${this.config.host}:${this.getActualPort()}`;
  }
}

// Convenience functions
export function createProxyServer(config?: ProxyConfig): AudioProxyServer {
  return new AudioProxyServer(config);
}

export async function startProxyServer(
  config?: ProxyConfig
): Promise<AudioProxyServer> {
  const server = createProxyServer(config);
  await server.start();
  return server;
}
