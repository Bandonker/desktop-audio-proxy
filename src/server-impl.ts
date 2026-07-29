import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Readable } from 'stream';
import { lookup as systemLookup, LookupAddress } from 'dns';
import { BlockList, isIP, LookupFunction } from 'net';
import { Agent as HttpAgent, Server as HttpServer } from 'http';
import { Agent as HttpsAgent } from 'https';
import { ProxyConfig } from './types';

const DEFAULT_PORT = 3002;
const DEFAULT_HOST = 'localhost';
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_MAX_REDIRECTS = 10;
const PACKAGE_VERSION = '1.1.8';
const DEFAULT_USER_AGENT = `AudioProxy/${PACKAGE_VERSION}`;
const DEFAULT_ALLOWED_PROTOCOLS: Array<'http' | 'https'> = ['http', 'https'];
const DEFAULT_CACHE_TTL = 3600;
const DEFAULT_MAX_CACHE_ENTRIES = 256;
const DEFAULT_ACCEPT_HEADER =
  'audio/*,video/*,application/vnd.apple.mpegurl,application/x-mpegURL,*/*;q=0.1';
const DEFAULT_ACCEPT_LANGUAGE_HEADER = 'en-US,en;q=0.9';
const MAX_HLS_PLAYLIST_BYTES = 2 * 1024 * 1024;

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
  'content-encoding',
  'accept-ranges',
  'cache-control',
  'expires',
  'last-modified',
  'etag',
];

type ErrorContext = 'info' | 'proxy';
type ResolvedProxyConfig = Omit<Required<ProxyConfig>, 'allowedHosts'> & {
  allowedHosts: string[] | null;
};

interface NormalizedError {
  status: number;
  body: {
    error: string;
    message?: string;
    url: string;
  };
}

interface InfoResponsePayload {
  url: string;
  status: number;
  headers: Record<string, unknown>;
  contentType?: string;
  contentLength?: string;
  acceptRanges?: string;
  lastModified?: string;
}

interface CachedInfoEntry {
  expiresAt: number;
  payload: InfoResponsePayload;
}

interface RequestUrlValidationResult {
  valid: boolean;
  status: number;
  url?: string;
  error?: string;
  message?: string;
}

interface RedirectRequestOptions {
  protocol?: string;
  hostname?: string;
  host?: string;
  auth?: string | null;
}

type LookupResolver = (
  hostname: string,
  options: { all: true; verbatim: true },
  callback: (
    error: NodeJS.ErrnoException | null,
    addresses: LookupAddress[]
  ) => void
) => void;

const NON_PUBLIC_IPV4 = new BlockList();
[
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].forEach(([address, prefix]) => {
  NON_PUBLIC_IPV4.addSubnet(address as string, prefix as number, 'ipv4');
});

const NON_PUBLIC_IPV6 = new BlockList();
[
  ['::', 128],
  ['::1', 128],
  ['::ffff:0:0', 96],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001::', 32],
  ['2001:2::', 48],
  ['2001:10::', 28],
  ['2001:20::', 28],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
].forEach(([address, prefix]) => {
  NON_PUBLIC_IPV6.addSubnet(address as string, prefix as number, 'ipv6');
});

function normalizeIpAddress(address: string): string {
  const withoutBrackets =
    address.startsWith('[') && address.endsWith(']')
      ? address.slice(1, -1)
      : address;
  return withoutBrackets.split('%', 1)[0].toLowerCase();
}

export function isPublicAddress(address: string): boolean {
  const normalizedAddress = normalizeIpAddress(address);
  const ipVersion = isIP(normalizedAddress);

  if (ipVersion === 4) {
    return !NON_PUBLIC_IPV4.check(normalizedAddress, 'ipv4');
  }

  if (ipVersion === 6) {
    const firstGroup = Number.parseInt(normalizedAddress.split(':', 1)[0], 16);
    const isGlobalUnicast =
      Number.isFinite(firstGroup) &&
      firstGroup >= 0x2000 &&
      firstGroup <= 0x3fff;

    return isGlobalUnicast && !NON_PUBLIC_IPV6.check(normalizedAddress, 'ipv6');
  }

  return false;
}

function createNetworkPolicyError(message: string): NodeJS.ErrnoException {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = 'EPRIVATEADDRESS';
  return error;
}

const HLS_VARIABLE_REFERENCE_REGEX = /\{\$([A-Za-z0-9_-]+)\}/g;

function expandKnownHlsVariables(
  value: string,
  definitions: ReadonlyMap<string, string>
): string {
  let expanded = value;
  for (let pass = 0; pass <= definitions.size; pass += 1) {
    const next = expanded.replace(
      HLS_VARIABLE_REFERENCE_REGEX,
      (reference, name: string) => definitions.get(name) ?? reference
    );
    if (next === expanded) {
      break;
    }
    expanded = next;
  }
  return expanded;
}

function toProxiedPlaylistReference(
  reference: string,
  baseUrl: string,
  definitions: ReadonlyMap<string, string>
): string {
  const expandedReference = expandKnownHlsVariables(reference, definitions);
  if (/^\{\$[A-Za-z0-9_-]+\}/.test(expandedReference)) {
    return reference;
  }

  const unresolvedVariables: Array<{
    placeholder: string;
    reference: string;
  }> = [];
  let placeholderIndex = 0;
  const protectedReference = expandedReference.replace(
    HLS_VARIABLE_REFERENCE_REGEX,
    variableReference => {
      let placeholder: string;
      do {
        placeholder = `daphlsvariable${placeholderIndex}marker`;
        placeholderIndex += 1;
      } while (
        expandedReference.includes(placeholder) ||
        baseUrl.includes(placeholder)
      );
      unresolvedVariables.push({
        placeholder,
        reference: variableReference,
      });
      return placeholder;
    }
  );

  try {
    const resolved = new URL(protectedReference, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return reference;
    }
    let encodedUrl = encodeURIComponent(resolved.toString());
    for (const variable of unresolvedVariables) {
      encodedUrl = encodedUrl
        .split(encodeURIComponent(variable.placeholder))
        .join(variable.reference);
    }
    return `/proxy?url=${encodedUrl}`;
  } catch {
    return reference;
  }
}

function getHlsQuotedAttribute(
  attributeList: string,
  name: 'NAME' | 'VALUE' | 'QUERYPARAM'
): string | undefined {
  return new RegExp(`(?:^|,)${name}="([^"]*)"`).exec(attributeList)?.[1];
}

function collectHlsVariableDefinitions(
  lines: readonly string[],
  baseUrl: string
): Map<string, string> {
  const definitions = new Map<string, string>();
  let baseQuery: URLSearchParams | undefined;
  try {
    baseQuery = new URL(baseUrl).searchParams;
  } catch {
    baseQuery = undefined;
  }

  for (const line of lines) {
    const trimmedLine = line.trim();
    const prefix = '#EXT-X-DEFINE:';
    if (!trimmedLine.startsWith(prefix)) {
      continue;
    }
    const attributeList = trimmedLine.slice(prefix.length);
    const name = getHlsQuotedAttribute(attributeList, 'NAME');
    const value = getHlsQuotedAttribute(attributeList, 'VALUE');
    if (name && value !== undefined) {
      definitions.set(name, value);
      continue;
    }
    const queryParameter = getHlsQuotedAttribute(attributeList, 'QUERYPARAM');
    if (queryParameter && baseQuery?.has(queryParameter)) {
      definitions.set(queryParameter, baseQuery.get(queryParameter) ?? '');
    }
  }
  return definitions;
}

export function isHostAllowed(
  hostname: string,
  allowedHosts: string[]
): boolean {
  const normalizedHostname = normalizeIpAddress(
    hostname.trim().toLowerCase().replace(/\.$/, '')
  );

  return allowedHosts.some(entry => {
    const pattern = entry.trim().toLowerCase().replace(/\.$/, '');
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2);
      return (
        normalizedHostname !== suffix &&
        normalizedHostname.endsWith(`.${suffix}`)
      );
    }
    return normalizedHostname === normalizeIpAddress(pattern);
  });
}

function isValidAllowedHostPattern(entry: string): boolean {
  const pattern = entry.trim().toLowerCase().replace(/\.$/, '');
  const wildcard = pattern.startsWith('*.');
  const hostname = wildcard ? pattern.slice(2) : pattern;

  if (!hostname || hostname.includes('*')) {
    return false;
  }

  const unwrappedAddress =
    hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname;
  const ipVersion = isIP(unwrappedAddress);
  if (ipVersion !== 0) {
    return !wildcard;
  }

  if (hostname.length > 253) {
    return false;
  }

  return hostname.split('.').every(label => {
    return (
      label.length >= 1 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    );
  });
}

export function rewriteHlsPlaylist(playlist: string, baseUrl: string): string {
  const lines = playlist.split(/\r?\n/);
  const definitions = collectHlsVariableDefinitions(lines, baseUrl);
  return lines
    .map(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        return line;
      }

      if (trimmedLine.startsWith('#')) {
        return line.replace(
          /URI="([^"]+)"/g,
          (_match, reference: string) =>
            `URI="${toProxiedPlaylistReference(
              reference,
              baseUrl,
              definitions
            )}"`
        );
      }

      const leadingWhitespace = line.slice(
        0,
        line.length - line.trimStart().length
      );
      const trailingWhitespace = line.slice(line.trimEnd().length);
      return (
        leadingWhitespace +
        toProxiedPlaylistReference(trimmedLine, baseUrl, definitions) +
        trailingWhitespace
      );
    })
    .join('\n');
}

function isHlsPlaylist(url: string, contentType: unknown): boolean {
  const normalizedContentType =
    typeof contentType === 'string' ? contentType.toLowerCase() : '';
  if (
    normalizedContentType.includes('mpegurl') ||
    normalizedContentType.includes('vnd.apple.mpegurl')
  ) {
    return true;
  }

  try {
    return new URL(url).pathname.toLowerCase().endsWith('.m3u8');
  } catch {
    return false;
  }
}

function getHeaderString(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const firstValue = value.find(item => typeof item === 'string');
    return typeof firstValue === 'string' ? firstValue : undefined;
  }
  return undefined;
}

function getFinalResponseUrl(
  response: AxiosResponse,
  fallbackUrl: string
): string {
  return (
    (
      response.request as
        | {
            res?: { responseUrl?: string };
          }
        | undefined
    )?.res?.responseUrl || fallbackUrl
  );
}

function normalizeMediaContentType(
  url: string,
  contentType: unknown
): string | undefined {
  const upstreamType = getHeaderString(contentType);
  const baseType = upstreamType?.split(';', 1)[0]?.trim().toLowerCase();
  if (
    baseType &&
    baseType !== 'application/octet-stream' &&
    baseType !== 'binary/octet-stream'
  ) {
    return upstreamType;
  }

  let pathname: string;
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return upstreamType;
  }

  const mediaTypes: Array<[string, string]> = [
    ['.m3u8', 'application/vnd.apple.mpegurl'],
    ['.mp3', 'audio/mpeg'],
    ['.m4a', 'audio/mp4'],
    ['.aac', 'audio/aac'],
    ['.wav', 'audio/wav'],
    ['.mp4', 'video/mp4'],
  ];
  return (
    mediaTypes.find(([extension]) => pathname.endsWith(extension))?.[1] ||
    upstreamType
  );
}

async function readPlaylist(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAX_HLS_PLAYLIST_BYTES) {
      const error = new Error(
        `HLS playlist exceeds ${MAX_HLS_PLAYLIST_BYTES} bytes`
      ) as NodeJS.ErrnoException;
      error.code = 'EPLAYLISTTOOLARGE';
      throw error;
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks, totalBytes);
}

export function createSafeLookup(
  resolver: LookupResolver = systemLookup as unknown as LookupResolver
): LookupFunction {
  return (hostname, options, callback) => {
    resolver(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) {
        callback(error, '', 0);
        return;
      }

      const requestedFamily = options.family || 0;
      const matchingAddresses = requestedFamily
        ? addresses.filter(address => address.family === requestedFamily)
        : addresses;

      if (matchingAddresses.length === 0) {
        const notFoundError = new Error(
          'Hostname did not resolve to a usable address'
        ) as NodeJS.ErrnoException;
        notFoundError.code = 'ENOTFOUND';
        callback(notFoundError, '', 0);
        return;
      }

      if (
        matchingAddresses.some(address => !isPublicAddress(address.address))
      ) {
        callback(
          createNetworkPolicyError(
            'Hostname resolved to a private or non-public address'
          ),
          '',
          0
        );
        return;
      }

      if (options.all) {
        callback(null, matchingAddresses);
        return;
      }

      const selectedAddress = matchingAddresses[0];
      callback(null, selectedAddress.address, selectedAddress.family);
    });
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function getSafeErrorSummary(error: unknown): string {
  return getErrorCode(error) || (error instanceof Error ? error.name : 'Error');
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
  if (typeof maybeCode === 'string') {
    return maybeCode;
  }

  return getErrorCode((error as { cause?: unknown }).cause);
}

export class AudioProxyServer {
  private app: express.Application;
  private server: HttpServer | null = null;
  private startPromise: Promise<void> | null = null;
  private config: ResolvedProxyConfig;
  private actualPort: number = 0;
  private infoCache: Map<string, CachedInfoEntry> = new Map();
  private httpAgent: HttpAgent | undefined;
  private httpsAgent: HttpsAgent | undefined;

  constructor(config: ProxyConfig = {}) {
    const allowedProtocols = [
      ...(config.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS),
    ];
    const corsOrigins =
      typeof config.corsOrigins === 'string'
        ? config.corsOrigins.trim()
        : config.corsOrigins?.map(origin => origin.trim());

    this.config = {
      port: config.port ?? DEFAULT_PORT,
      host: config.host?.trim() ?? DEFAULT_HOST,
      corsOrigins: corsOrigins ?? '*',
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      maxRedirects: config.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
      userAgent: config.userAgent ?? DEFAULT_USER_AGENT,
      allowedProtocols,
      allowedHosts:
        config.allowedHosts === undefined
          ? null
          : config.allowedHosts.map(hostname => hostname.trim().toLowerCase()),
      allowPrivateAddresses: config.allowPrivateAddresses ?? false,
      enableLogging: config.enableLogging ?? true,
      enableTranscoding: config.enableTranscoding ?? false,
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTL: config.cacheTTL ?? DEFAULT_CACHE_TTL,
      maxCacheEntries: config.maxCacheEntries ?? DEFAULT_MAX_CACHE_ENTRIES,
    };

    this.validateConfig();

    if (!this.config.allowPrivateAddresses) {
      const safeLookup = createSafeLookup();
      this.httpAgent = new HttpAgent({ lookup: safeLookup });
      this.httpsAgent = new HttpsAgent({ lookup: safeLookup });
    }

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    const allowCredentials = this.config.corsOrigins !== '*';

    // CORS middleware
    this.app.use(
      cors({
        origin: this.config.corsOrigins,
        credentials: allowCredentials,
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
    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        version: PACKAGE_VERSION,
        uptime: getProcessUptime(),
        config: {
          port: this.actualPort || this.config.port,
          configuredPort: this.config.port,
          allowedProtocols: this.config.allowedProtocols,
          allowPrivateAddresses: this.config.allowPrivateAddresses,
          enableTranscoding: this.config.enableTranscoding,
          cacheEnabled: this.config.cacheEnabled,
          maxCacheEntries: this.config.maxCacheEntries,
        },
      });
    });

    // Info endpoint
    this.app.get('/info', async (req: Request, res: Response) => {
      const validationResult = this.getRequestUrl(req);
      if (!validationResult.valid || !validationResult.url) {
        return res.status(validationResult.status).json({
          error: validationResult.error || 'Invalid URL parameter',
          ...(validationResult.message
            ? { message: validationResult.message }
            : {}),
        });
      }
      const url = validationResult.url;

      const cachedInfo = this.getCachedInfo(url);
      if (cachedInfo) {
        return res.json(cachedInfo);
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
          decompress: false,
          ...this.getSecureNetworkOptions(),
        });

        const finalUrl = getFinalResponseUrl(response, url);
        const headers = this.pickProxiedResponseHeaders(response.headers);
        const normalizedContentType = normalizeMediaContentType(
          finalUrl,
          response.headers['content-type']
        );
        if (normalizedContentType) {
          headers['content-type'] = normalizedContentType;
        }
        const payload: InfoResponsePayload = {
          url,
          status: response.status,
          headers,
          contentType: normalizedContentType,
          contentLength: getHeaderString(response.headers['content-length']),
          acceptRanges: getHeaderString(response.headers['accept-ranges']),
          lastModified: getHeaderString(response.headers['last-modified']),
        };

        this.setCachedInfo(url, payload);

        return res.json(payload);
      } catch (error: unknown) {
        console.error('[AudioProxy] Info error:', getSafeErrorSummary(error));
        const normalizedError = this.normalizeRequestError(error, url, 'info');
        return res.status(normalizedError.status).json(normalizedError.body);
      }
    });

    // Proxy endpoint
    this.app.get('/proxy', async (req: Request, res: Response) => {
      const validationResult = this.getRequestUrl(req);
      if (!validationResult.valid || !validationResult.url) {
        return res.status(validationResult.status).json({
          error: validationResult.error || 'Invalid URL parameter',
          ...(validationResult.message
            ? { message: validationResult.message }
            : {}),
        });
      }
      const url = validationResult.url;

      try {
        // Prepare request headers
        const requestHeaders: Record<string, string> = {
          'User-Agent': this.config.userAgent,
          Accept: req.headers.accept || DEFAULT_ACCEPT_HEADER,
          'Accept-Language':
            req.headers['accept-language'] || DEFAULT_ACCEPT_LANGUAGE_HEADER,
          'Accept-Encoding': 'identity',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        };

        const requestAbortController = new AbortController();

        // Handle range requests for seeking support
        if (req.headers.range) {
          requestHeaders['Range'] = req.headers.range;
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
          decompress: false,
          ...this.getSecureNetworkOptions(),
        });

        // Set response status
        res.status(response.status);

        // Copy relevant headers from the original response
        const finalUrl = getFinalResponseUrl(response, url);
        const responseHeaders = this.pickProxiedResponseHeaders(
          response.headers
        );
        const normalizedContentType = normalizeMediaContentType(
          finalUrl,
          response.headers['content-type']
        );
        if (normalizedContentType) {
          responseHeaders['content-type'] = normalizedContentType;
        }
        Object.entries(responseHeaders).forEach(([header, value]) => {
          if (typeof value === 'string' || Array.isArray(value)) {
            res.set(header, value);
          }
        });

        const stream = response.data as Readable;

        if (
          isHlsPlaylist(finalUrl, normalizedContentType) &&
          !response.headers['content-encoding'] &&
          response.status === 200 &&
          !req.headers.range
        ) {
          const abortPlaylistRead = (): void => {
            requestAbortController.abort();
            if (!stream.destroyed) {
              stream.destroy();
            }
          };
          req.once('aborted', abortPlaylistRead);
          res.once('close', abortPlaylistRead);

          try {
            const playlistBuffer = await readPlaylist(stream);
            if (res.destroyed || res.writableEnded) {
              return;
            }
            const rewrittenPlaylist = rewriteHlsPlaylist(
              playlistBuffer.toString('utf8'),
              finalUrl
            );
            res.removeHeader('content-length');
            return res.send(rewrittenPlaylist);
          } finally {
            req.removeListener('aborted', abortPlaylistRead);
            res.removeListener('close', abortPlaylistRead);
            requestAbortController.abort();
            if (!stream.destroyed) {
              stream.destroy();
            }
          }
        }

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
          console.error(
            '[AudioProxy] Response error:',
            getSafeErrorSummary(error)
          );
          cleanup(true);
        };

        const handleStreamError = (error: Error) => {
          console.error(
            '[AudioProxy] Stream error:',
            getSafeErrorSummary(error)
          );
          if (this.canSendJsonResponse(res)) {
            this.clearProxiedResponseHeaders(res);
            res.status(500).json({
              error: 'Stream error',
              message: 'The upstream stream ended unexpectedly',
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
        console.error('[AudioProxy] Proxy error:', getSafeErrorSummary(error));

        if (this.canSendJsonResponse(res)) {
          this.clearProxiedResponseHeaders(res);
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

  private clearProxiedResponseHeaders(res: Response): void {
    PROXIED_RESPONSE_HEADERS.forEach(header => res.removeHeader(header));
  }

  private getRequestUrl(req: Request): RequestUrlValidationResult {
    if (typeof req.query.url !== 'string') {
      return {
        valid: false,
        status: 400,
        error: 'URL parameter required',
      };
    }

    const normalizedUrl = req.query.url.trim();
    if (normalizedUrl.length === 0) {
      return {
        valid: false,
        status: 400,
        error: 'URL parameter required',
      };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(normalizedUrl);
    } catch {
      return {
        valid: false,
        status: 400,
        error: 'Invalid URL parameter',
        message: 'Only absolute URLs are supported',
      };
    }

    const protocol = parsedUrl.protocol.slice(0, -1).toLowerCase();
    if (!this.config.allowedProtocols.includes(protocol as 'http' | 'https')) {
      return {
        valid: false,
        status: 400,
        error: 'Unsupported URL protocol',
        message: `Allowed protocols: ${this.config.allowedProtocols.join(', ')}`,
      };
    }

    if (parsedUrl.username || parsedUrl.password) {
      return {
        valid: false,
        status: 400,
        error: 'URL credentials are not supported',
        message: 'Use host-managed authentication instead of URL user info',
      };
    }

    if (
      this.config.allowedHosts !== null &&
      !isHostAllowed(parsedUrl.hostname, this.config.allowedHosts)
    ) {
      return {
        valid: false,
        status: 403,
        error: 'Target host is not allowed',
        message: 'Add the station host to ProxyConfig.allowedHosts',
      };
    }

    if (
      !this.config.allowPrivateAddresses &&
      this.isPrivateOrLocalHost(parsedUrl.hostname)
    ) {
      return {
        valid: false,
        status: 403,
        error: 'Private or local addresses are blocked',
        message:
          'Set allowPrivateAddresses=true in ProxyConfig only for trusted local network sources',
      };
    }

    return {
      valid: true,
      status: 200,
      url: parsedUrl.toString(),
    };
  }

  private getCachedInfo(url: string): InfoResponsePayload | null {
    if (!this.config.cacheEnabled) {
      return null;
    }

    const cachedEntry = this.infoCache.get(url);
    if (!cachedEntry) {
      return null;
    }

    if (cachedEntry.expiresAt <= Date.now()) {
      this.infoCache.delete(url);
      return null;
    }

    this.infoCache.delete(url);
    this.infoCache.set(url, cachedEntry);
    return cachedEntry.payload;
  }

  private setCachedInfo(url: string, payload: InfoResponsePayload): void {
    if (!this.config.cacheEnabled) {
      return;
    }

    const ttlMs = Math.max(1, this.config.cacheTTL) * 1000;
    const now = Date.now();

    for (const [cachedUrl, cachedEntry] of this.infoCache) {
      if (cachedEntry.expiresAt <= now) {
        this.infoCache.delete(cachedUrl);
      }
    }

    this.infoCache.delete(url);
    while (this.infoCache.size >= this.config.maxCacheEntries) {
      const oldestUrl = this.infoCache.keys().next().value as
        | string
        | undefined;
      if (!oldestUrl) {
        break;
      }
      this.infoCache.delete(oldestUrl);
    }

    this.infoCache.set(url, {
      expiresAt: now + ttlMs,
      payload,
    });
  }

  private isPrivateOrLocalHost(hostname: string): boolean {
    const normalizedHost = normalizeIpAddress(
      hostname.toLowerCase().replace(/\.$/, '')
    );

    if (
      normalizedHost === 'localhost' ||
      normalizedHost.endsWith('.localhost') ||
      normalizedHost.endsWith('.local') ||
      normalizedHost.endsWith('.localdomain') ||
      normalizedHost.endsWith('.lan') ||
      normalizedHost.endsWith('.internal') ||
      normalizedHost === 'home.arpa' ||
      normalizedHost.endsWith('.home.arpa')
    ) {
      return true;
    }

    return isIP(normalizedHost) !== 0 && !isPublicAddress(normalizedHost);
  }

  private validateConfig(): void {
    if (
      !Number.isInteger(this.config.port) ||
      this.config.port < 0 ||
      this.config.port > 65535
    ) {
      throw new RangeError('Proxy port must be an integer between 0 and 65535');
    }

    if (!this.config.host.trim()) {
      throw new TypeError('Proxy host must not be empty');
    }

    if (
      typeof this.config.corsOrigins === 'string'
        ? !this.config.corsOrigins.trim()
        : this.config.corsOrigins.length === 0 ||
          this.config.corsOrigins.some(origin => !origin.trim())
    ) {
      throw new TypeError('corsOrigins must contain at least one origin');
    }

    if (
      this.config.allowedProtocols.length === 0 ||
      this.config.allowedProtocols.some(
        protocol => protocol !== 'http' && protocol !== 'https'
      )
    ) {
      throw new TypeError('allowedProtocols may contain only http and https');
    }

    if (
      this.config.allowedHosts !== null &&
      this.config.allowedHosts.some(
        hostname => !isValidAllowedHostPattern(hostname)
      )
    ) {
      throw new TypeError(
        'allowedHosts entries must be exact hostnames or *.example.com patterns'
      );
    }

    if (!Number.isFinite(this.config.timeout) || this.config.timeout <= 0) {
      throw new RangeError('Proxy timeout must be greater than zero');
    }

    if (
      !Number.isInteger(this.config.maxRedirects) ||
      this.config.maxRedirects < 0
    ) {
      throw new RangeError('maxRedirects must be a non-negative integer');
    }

    if (!Number.isFinite(this.config.cacheTTL) || this.config.cacheTTL <= 0) {
      throw new RangeError('cacheTTL must be greater than zero');
    }

    if (
      !Number.isInteger(this.config.maxCacheEntries) ||
      this.config.maxCacheEntries <= 0
    ) {
      throw new RangeError('maxCacheEntries must be a positive integer');
    }

    if (this.config.enableTranscoding) {
      throw new TypeError(
        'enableTranscoding is not implemented; transcode media in the host application'
      );
    }
  }

  private validateRedirect(options: RedirectRequestOptions): void {
    const protocol = (options.protocol || '').replace(/:$/, '').toLowerCase();
    if (!this.config.allowedProtocols.includes(protocol as 'http' | 'https')) {
      throw createNetworkPolicyError('Redirect used an unsupported protocol');
    }

    if (options.auth) {
      throw createNetworkPolicyError('Redirect URL credentials are blocked');
    }

    const hostname = options.hostname || options.host;
    if (
      !hostname ||
      (!this.config.allowPrivateAddresses &&
        this.isPrivateOrLocalHost(hostname))
    ) {
      throw createNetworkPolicyError(
        'Redirect targeted a private or non-public address'
      );
    }

    if (
      this.config.allowedHosts !== null &&
      !isHostAllowed(hostname, this.config.allowedHosts)
    ) {
      throw createNetworkPolicyError('Redirect target host is not allowed');
    }
  }

  private getSecureNetworkOptions(): Pick<
    AxiosRequestConfig,
    'httpAgent' | 'httpsAgent' | 'proxy' | 'beforeRedirect'
  > {
    if (
      this.config.allowPrivateAddresses &&
      this.config.allowedHosts === null
    ) {
      return {};
    }

    const redirectPolicy = {
      beforeRedirect: (options: RedirectRequestOptions) =>
        this.validateRedirect(options),
    };

    if (this.config.allowPrivateAddresses) {
      return redirectPolicy;
    }

    return {
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent,
      proxy: false,
      ...redirectPolicy,
    };
  }

  private pickProxiedResponseHeaders(
    headers: Record<string, unknown>
  ): Record<string, string> {
    const safeHeaders: Record<string, string> = {};
    PROXIED_RESPONSE_HEADERS.forEach(header => {
      const value = getHeaderString(headers[header]);
      if (value !== undefined) {
        safeHeaders[header] = value;
      }
    });
    return safeHeaders;
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

    if (errorCode === 'EPRIVATEADDRESS') {
      return {
        status: 403,
        body: {
          error: 'Private or non-public addresses are blocked',
          message: 'The target or one of its redirects failed network policy',
          url,
        },
      };
    }

    if (errorCode === 'EPLAYLISTTOOLARGE') {
      return {
        status: 413,
        body: {
          error: 'HLS playlist is too large',
          message: `Playlist metadata is limited to ${MAX_HLS_PLAYLIST_BYTES} bytes`,
          url,
        },
      };
    }

    return {
      status: 500,
      body: {
        error: fallbackError,
        message: 'Unexpected upstream request failure',
        url,
      },
    };
  }

  public async start(): Promise<void> {
    if (this.server?.listening) {
      return;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    const startOperation = this.startInternal();
    this.startPromise = startOperation;

    try {
      await startOperation;
    } finally {
      if (this.startPromise === startOperation) {
        this.startPromise = null;
      }
    }
  }

  private async startInternal(): Promise<void> {
    try {
      const candidatePorts =
        this.config.port === 0
          ? [0]
          : Array.from(
              { length: Math.min(10, 65536 - this.config.port) },
              (_, index) => this.config.port + index
            );

      let lastError: unknown;
      for (const candidatePort of candidatePorts) {
        try {
          this.server = await this.listen(candidatePort);
          const address = this.server.address();
          this.actualPort =
            address && typeof address !== 'string'
              ? address.port
              : candidatePort;

          if (this.config.port !== 0 && this.actualPort !== this.config.port) {
            console.log(
              `⚠️  Port ${this.config.port} was occupied, using port ${this.actualPort} instead`
            );
          }
          console.log(`Desktop Audio Proxy running on ${this.getProxyUrl()}`);
          console.log(`Use ${this.getProxyUrl()}/proxy?url=YOUR_AUDIO_URL`);
          return;
        } catch (error: unknown) {
          lastError = error;
          if (getErrorCode(error) !== 'EADDRINUSE' || candidatePort === 0) {
            throw error;
          }
        }
      }

      throw (
        lastError ||
        new Error(
          `No available port found in range ${this.config.port}-${this.config.port + 9}`
        )
      );
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      throw new Error(`Failed to start proxy server: ${errorMessage}`);
    }
  }

  private listen(port: number): Promise<HttpServer> {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(port, this.config.host);

      const handleError = (error: Error): void => {
        server.removeListener('listening', handleListening);
        reject(error);
      };
      const handleListening = (): void => {
        server.removeListener('error', handleError);
        resolve(server);
      };

      server.once('error', handleError);
      server.once('listening', handleListening);
    });
  }

  public async stop(): Promise<void> {
    if (this.startPromise) {
      try {
        await this.startPromise;
      } catch {
        // A failed start has no listening server to close.
      }
    }

    return new Promise((resolve, reject) => {
      this.infoCache.clear();
      const server = this.server;
      this.server = null;
      this.actualPort = 0;

      if (server?.listening) {
        server.close(error => {
          if (error) {
            reject(error);
            return;
          }
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
    const connectHost =
      this.config.host === '0.0.0.0' || this.config.host === '::'
        ? 'localhost'
        : this.config.host;
    const formattedHost =
      connectHost.includes(':') && !connectHost.startsWith('[')
        ? `[${connectHost}]`
        : connectHost;
    return `http://${formattedHost}:${this.getActualPort()}`;
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
