## Security Posture

This document reflects the **current implemented behavior** of the repository and calls out hardening items that are still deferred.

## Implemented Controls (Current)

### Request handling and bounds
- Proxy and info routes require a `url` query parameter and reject blank values.
- Only absolute HTTP(S) targets are accepted, and URL credentials are rejected.
- Private, loopback, link-local, reserved, and other non-public literal IP
  addresses are blocked by default.
- DNS results are checked at connection time, including mixed public/private
  answers, and every redirect target is revalidated.
- Optional `allowedHosts` rules enforce exact hosts and boundary-safe wildcard
  subdomains on initial requests and redirects. An explicit empty list denies
  every outbound target.
- Environment HTTP proxy settings are bypassed while the outbound network
  policy is active so they cannot sidestep destination validation.
- Upstream requests are bounded by configurable `timeout` and `maxRedirects` values.
- Error responses are normalized for timeout/DNS/connection-refused scenarios.

### Stream lifecycle safety
- Proxy stream handling includes conservative cleanup for request abort, response close/error/finish, and upstream stream errors.
- Cleanup paths are idempotent to reduce duplicate teardown side effects.

### CORS behavior
- CORS behavior is configurable through `corsOrigins`.
- Default behavior is compatibility-oriented (`*`) and does not advertise
  credential support.
- Explicit origins may use credentialed CORS and should be restricted to
  trusted application origins.

### Data minimization and resource bounds
- Only media-relevant response headers are forwarded; upstream cookies and
  custom/internal headers are not exposed.
- Metadata caching has a configurable TTL and bounded entry count.
- Diagnostic logs and built-in telemetry redact remote URL paths, query values,
  and credentials.

### Logging and telemetry
- Request logging is optional (`enableLogging`) and can be disabled.
- Telemetry is optional and local unless an application forwards events through callbacks.

## Deferred Hardening Items (Not Implemented in Core)

The following protections are **not currently provided by this library out of the box** and should be implemented in the host application and deployment environment:

- Built-in authentication/authorization for proxy endpoints
- Built-in rate limiting and abuse throttling
- General streamed-response size caps (HLS manifest metadata is limited to 2 MiB)

## Best Practices

#### 1. Restrict outbound station hosts
```typescript
const server = await startProxyServer({
  allowedHosts: [
    'stream.example.com',
    '*.trusted-radio-cdn.example',
  ],
});
```

HLS playlists may reference separate hosts for variants, keys, and segments.
Add only the CDN suffixes actually required by the station catalog.

#### 2. Restrictive proxy config in production
```typescript
// Restrict CORS and tighten request limits in production
const server = await startProxyServer({
  port: 3002,
  host: 'localhost',
  corsOrigins: ['https://yourapp.com'],
  allowedHosts: ['stream.example.com', '*.trusted-radio-cdn.example'],
  timeout: 30000,
  maxRedirects: 5,
  maxCacheEntries: 128,
  enableLogging: false,
});
```

#### 3. Scope auto-start usage
```typescript
// Auto-start can be limited by environment policy
const client = createAudioClient({
  autoStartProxy: process.env.NODE_ENV === 'development',
  proxyServerConfig: {
    corsOrigins:
      process.env.NODE_ENV === 'development' ? '*' : 'https://yourapp.com',
  },
});
```

## Reporting a Vulnerability

If you discover a security vulnerability, please message me or open a security advisory on GitHub.

**Please do NOT open a public issue for security vulnerabilities.**

### What to include:
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)


## Known Security Considerations

### 1. Proxy Server Exposure
The proxy server can access public HTTP(S) URLs by default. In production:
- Run proxy server behind authentication
- Use URL whitelisting
- Monitor proxy usage
- Keep `allowPrivateAddresses: false`; enabling it disables the built-in
  destination safety policy and should be limited to a trusted network

### 2. Local File Access
In Tauri/Electron, the library can access local files. Ensure:
- Proper file permission configuration
- User consent for file access
- Sanitize file paths

### 3. CORS Bypass
The library intentionally provides a local CORS bridge. Use responsibly:
- Only proxy trusted sources
- Implement content validation
- Monitor for abuse
