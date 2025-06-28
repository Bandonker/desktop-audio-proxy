# Desktop Audio Proxy

This is a comprehensive audio streaming solution for Tauri and Electron applications that bypasses CORS restrictions and handles WebKit codec compatibility issues.

[![npm version](https://badge.fury.io/js/desktop-audio-proxy.svg)](https://badge.fury.io/js/desktop-audio-proxy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **CORS Bypass** - Play external audio URLs without CORS restrictions
- **WebKit Compatibility** - Solves codec issues in Tauri/Electron WebView
- **Environment Detection** - Automatically detects Tauri, Electron, or web environment
- **Smart Fallbacks** - Graceful degradation when proxy unavailable
- **Retry Logic** - Configurable retry attempts with delays
- **Health Monitoring** - Built-in health and info endpoints
- **TypeScript** - Full type safety and IntelliSense support
- **Range Requests** - Support for audio seeking and streaming

## The Problem

When building desktop applications with web technologies (Tauri, Electron), developers often face:

1. **CORS Issues**: External audio URLs (podcasts, radio streams) are blocked due to Cross-Origin Resource Sharing policies
2. **Codec Compatibility**: WebKit may not support certain audio codecs even with proper GStreamer plugins installed
3. **Authentication**: Some audio streams require special headers or authentication
4. **Redirects**: Many podcast/streaming URLs use multiple redirects that cause issues

## The Solution

Desktop Audio Proxy provides:

- **Automatic CORS bypass** for external audio URLs
- **Codec transcoding** support (optional, requires ffmpeg)
- **Smart redirect handling** with configurable limits
- **Automatic environment detection** (Tauri/Electron/Web)
- **Optional caching** for better performance
- **Simple API** that works like a drop-in replacement

## Installation

```bash
npm install desktop-audio-proxy
# or
yarn add desktop-audio-proxy
# or
pnpm add desktop-audio-proxy
```

## Quick Start

### Basic Usage (Automatic Setup)

```typescript
import { createAudioClient } from 'desktop-audio-proxy';

// Create client with auto-detection
const audioClient = createAudioClient();

// Convert any audio URL to a playable URL
const playableUrl = await audioClient.getPlayableUrl('https://example.com/podcast.mp3');

// Use in your audio element
audioElement.src = playableUrl;
```

### With Proxy Server

```typescript
import { startProxyServer, createAudioClient } from 'desktop-audio-proxy';

// Start the proxy server
const proxyServer = await startProxyServer({ port: 3001 });

// Create client that uses the proxy
const audioClient = createAudioClient({
  proxyUrl: 'http://localhost:3001'
});

// Convert URL
const playableUrl = await audioClient.getPlayableUrl('https://example.com/audio.mp3');
```

### Tauri Integration

```typescript
import { TauriAudioService } from 'desktop-audio-proxy';

const audioService = new TauriAudioService({
  // Automatically uses proxy in dev, direct URLs in production
  autoDetect: true
});

// In your audio player
const streamUrl = await audioService.getStreamableUrl(originalUrl);
audioElement.src = streamUrl;
```

### Electron Integration

```typescript
import { ElectronAudioService } from 'desktop-audio-proxy';

const audioService = new ElectronAudioService({
  enableTranscoding: true // Optional: transcode unsupported formats
});

const streamUrl = await audioService.getStreamableUrl(originalUrl);
```

## Advanced Configuration

```typescript
const audioClient = createAudioClient({
  proxyUrl: 'http://localhost:3002',
  autoDetect: true,
  fallbackToOriginal: true,
  retryAttempts: 3,
  retryDelay: 1000,
  
  // Optional proxy server config
  proxyConfig: {
    port: 3002,
    corsOrigins: '*',
    timeout: 60000,
    maxRedirects: 20,
    enableLogging: true,
    enableTranscoding: false,
    cacheEnabled: true,
    cacheTTL: 3600
  },
  
  // Optional transcoding config (requires ffmpeg)
  transcodingOptions: {
    format: 'mp3',
    bitrate: 128,
    sampleRate: 44100,
    channels: 2
  }
});
```

## API Reference

### AudioProxyClient

```typescript
class AudioProxyClient {
  constructor(options?: AudioProxyOptions);
  
  // Get a playable URL for any audio source
  getPlayableUrl(url: string): Promise<string>;
  
  // Check if a URL can be played directly
  canPlayUrl(url: string): Promise<StreamInfo>;
  
  // Get environment info
  getEnvironment(): Environment;
  
  // Check if proxy is available
  isProxyAvailable(): Promise<boolean>;
}
```

### AudioProxyServer

```typescript
class AudioProxyServer {
  constructor(config?: ProxyConfig);
  
  // Start the proxy server
  start(): Promise<void>;
  
  // Stop the proxy server
  stop(): Promise<void>;
  
  // Get server info
  getInfo(): { port: number; host: string; isRunning: boolean };
}
```

## Examples

### Standalone Server

You can run a standalone proxy server using the included example:

```bash
# Start standalone proxy server
npm run proxy:start

# Or run the example directly
node examples/standalone-server.js
```

## Troubleshooting

### Common Issues

1. **"Media format not supported"**: Install GStreamer plugins or enable transcoding
2. **"CORS error"**: Ensure the proxy server is running
3. **"Connection refused"**: Check if the proxy port is available

### Debug Mode

```typescript
const audioClient = createAudioClient({
  proxyConfig: {
    enableLogging: true
  }
});

// Enable debug logs
if (process.env.NODE_ENV === 'development') {
  audioClient.enableDebug();
}
```

## License

MIT © Bandonker

<div align="center">
  <sub>Made with ❤️ by Bandonker</sub>
</div>

## Related Projects

- [Tauri](https://tauri.app) - Build smaller, faster, and more secure desktop applications
- [Electron](https://www.electronjs.org) - Build cross-platform desktop apps with web technologies

## Support

- [Report bugs](https://github.com/Bandonker/desktop-audio-proxy/issues)
- [Request features](https://github.com/Bandonker/desktop-audio-proxy/discussions)
- [Read the docs](https://github.com/Bandonker/desktop-audio-proxy/wiki)
