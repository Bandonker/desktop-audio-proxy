import express, { Request, Response } from 'express';
import cors from 'cors';
import axios, { AxiosResponse, AxiosError } from 'axios';
import { Readable } from 'stream';
import { createServer } from 'net';
import { Server as HttpServer } from 'http';
import { ProxyConfig } from './types';

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
      port: config.port || 3002,
      host: config.host || 'localhost',
      corsOrigins: config.corsOrigins || '*',
      timeout: config.timeout || 60000,
      maxRedirects: config.maxRedirects || 10,
      userAgent: config.userAgent || 'AudioProxy/1.0',
      enableLogging: config.enableLogging ?? true,
      enableTranscoding: config.enableTranscoding ?? false,
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTL: config.cacheTTL || 3600,
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
        exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
        methods: ['GET', 'OPTIONS', 'HEAD'],
        allowedHeaders: ['Content-Type', 'Range', 'Accept-Encoding'],
      })
    );

    // Logging middleware
    if (this.config.enableLogging) {
      this.app.use((req: Request, res: Response, next) => {
        console.log(`[AudioProxy] ${req.method} ${req.path}`);
        next();
      });
    }
  }

  private setupRoutes(): void {
    // Handle CORS preflight for all routes
    this.app.options('*', (req: Request, res: Response) => {
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
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        version: '1.1.1',
        uptime: process.uptime(),
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
      const url = req.query.url as string;
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
            Accept: 'audio/*,*/*;q=0.1',
          },
          timeout: this.config.timeout,
          maxRedirects: this.config.maxRedirects,
          validateStatus: status => status < 400,
        });

        res.json({
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

        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as AxiosError;
          if (axiosError.response) {
            res.status(axiosError.response.status).json({
              error: `Upstream error: ${axiosError.response.status} ${axiosError.response.statusText}`,
              url: url,
            });
          }
        } else {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          res.status(500).json({
            error: 'Failed to get stream info',
            message: errorMessage,
            url: url,
          });
        }
      }
    });

    // Proxy endpoint
    this.app.get('/proxy', async (req: Request, res: Response) => {
      const url = req.query.url as string;
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
          Accept: req.headers.accept || 'audio/*,*/*;q=0.1',
          'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        };

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
          validateStatus: status => status < 400, // Accept redirects and success codes
        });

        // Set response status
        res.status(response.status);

        // Copy relevant headers from the original response
        const headersToProxy = [
          'content-type',
          'content-length',
          'content-range',
          'accept-ranges',
          'cache-control',
          'expires',
          'last-modified',
          'etag',
        ];

        headersToProxy.forEach(header => {
          const value = response.headers[header];
          if (value) {
            res.set(header, value);
          }
        });

        // Handle errors during streaming
        const stream = response.data as Readable;

        stream.on('error', error => {
          console.error('[AudioProxy] Stream error:', error);
          if (!res.headersSent) {
            res.status(500).json({
              error: 'Stream error',
              message: error.message,
            });
          } else {
            res.end();
          }
        });

        res.on('close', () => {
          // Clean up stream if client disconnects
          if (stream && !stream.destroyed) {
            stream.destroy();
          }
        });

        res.on('error', error => {
          console.error('[AudioProxy] Response error:', error);
          if (stream && !stream.destroyed) {
            stream.destroy();
          }
        });

        // Pipe the stream to response
        stream.pipe(res);
      } catch (error: unknown) {
        console.error('[AudioProxy] Proxy error:', error);

        if (!res.headersSent) {
          if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as AxiosError;
            if (axiosError.response) {
              // HTTP error from upstream
              res.status(axiosError.response.status).json({
                error: `Upstream error: ${axiosError.response.status} ${axiosError.response.statusText}`,
                url: url,
              });
            }
          } else if (error && typeof error === 'object' && 'code' in error) {
            const nodeError = error as { code: string; message?: string };
            if (nodeError.code === 'ENOTFOUND') {
              // DNS resolution failed
              res.status(404).json({
                error: 'Audio source not found',
                message: 'Unable to resolve hostname',
                url: url,
              });
            } else if (nodeError.code === 'ECONNREFUSED') {
              // Connection refused
              res.status(503).json({
                error: 'Audio source unavailable',
                message: 'Connection refused',
                url: url,
              });
            } else if (nodeError.code === 'ETIMEDOUT') {
              // Request timeout
              res.status(408).json({
                error: 'Request timeout',
                message: 'Audio source did not respond in time',
                url: url,
              });
            } else {
              // Generic error with code
              const errorMessage = nodeError.message || 'Unknown error';
              res.status(500).json({
                error: 'Proxy request failed',
                message: errorMessage,
                url: url,
              });
            }
          } else {
            // Generic error
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({
              error: 'Proxy request failed',
              message: errorMessage,
              url: url,
            });
          }
        }
      }
    });
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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
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
