## Security Features

### URL Sanitization
- All URLs are validated before processing
- Invalid URLs are rejected with clear error messages
- URL encoding is automatically applied

### CORS Configuration
- Configurable CORS origins
- Default restrictive CORS policy
- Option to whitelist specific domains

###  Proxy Server Security
- Configurable timeout limits to prevent hanging requests
- Max redirects limit to prevent redirect loops
- Request size limits
- Rate limiting (configurable)

### Best Practices

#### 1. URL Whitelisting
```typescript
// Recommended: Validate URLs before passing to library
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

#### 2. Proxy Server Configuration
```typescript
// Use restrictive CORS in production
const server = await startProxyServer({
  port: 3002,
  corsOrigins: ['https://yourapp.com'], // Specific origins only
  timeout: 30000, // 30 second timeout
  maxRedirects: 5, // Limit redirects
  enableLogging: false // Disable logging in production
});
```

#### 3. Auto-Start Proxy
```typescript
// Only enable auto-start in development
const client = createAudioClient({
  autoStartProxy: process.env.NODE_ENV === 'development',
  proxyServerConfig: {
    corsOrigins: process.env.NODE_ENV === 'development' ? '*' : 'https://yourapp.com'
  }
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

