## Security Posture

This document reflects the **current implemented behavior** of the repository and calls out hardening items that are still deferred.

## Implemented Controls (Current)

### Request handling and bounds
- Proxy and info routes require a `url` query parameter and reject blank values.
- Upstream requests are bounded by configurable `timeout` and `maxRedirects` values.
- Error responses are normalized for timeout/DNS/connection-refused scenarios.

### Stream lifecycle safety
- Proxy stream handling includes conservative cleanup for request abort, response close/error/finish, and upstream stream errors.
- Cleanup paths are idempotent to reduce duplicate teardown side effects.

### CORS behavior
- CORS behavior is configurable through `corsOrigins`.
- Default behavior is compatibility-oriented (`*`) and should be tightened by deployers for production use.

### Logging and telemetry
- Request logging is optional (`enableLogging`) and can be disabled.
- Telemetry is optional and local unless an application forwards events through callbacks.

## Deferred Hardening Items (Not Implemented in Core)

The following protections are **not currently provided by this library out of the box** and should be implemented in the host application and deployment environment:

- Built-in authentication/authorization for proxy endpoints
- Built-in URL allowlist/denylist enforcement for outbound proxy targets
- Built-in rate limiting and abuse throttling
- Built-in SSRF egress policy controls (network segmentation/firewalling remains external)
- Built-in request/response body size enforcement controls

## Best Practices

#### 1. URL Whitelisting in your app
```typescript
// Recommended: Validate URLs before passing to the library
const allowedDomains = ['example.com', 'cdn.example.com'];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return allowedDomains.some(domain => parsed.hostname.endsWith(domain));
  } catch {
    return false;
  }
}

if (isAllowedUrl(audioUrl)) {
  const playableUrl = await client.getPlayableUrl(audioUrl);
}
```

#### 2. Restrictive proxy config in production
```typescript
// Restrict CORS and tighten request limits in production
const server = await startProxyServer({
  port: 3002,
  corsOrigins: ['https://yourapp.com'],
  timeout: 30000,
  maxRedirects: 5,
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
The proxy server can access any URL it's configured to proxy. In production:
- Run proxy server behind authentication
- Use URL whitelisting
- Monitor proxy usage

### 2. Local File Access
In Tauri/Electron, the library can access local files. Ensure:
- Proper file permission configuration
- User consent for file access
- Sanitize file paths

### 3. CORS Bypass
The library intentionally bypasses CORS. Use responsibly:
- Only proxy trusted sources
- Implement content validation
- Monitor for abuse

