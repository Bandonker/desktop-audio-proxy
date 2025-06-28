# Changelog

All notable changes to Desktop Audio Proxy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-06-27

### Added
- Initial release of Desktop Audio Proxy
- `AudioProxyClient` for handling URL conversion and environment detection
- `AudioProxyServer` for CORS bypass and streaming proxy
- `TauriAudioService` with Tauri-specific optimizations
- `ElectronAudioService` with Electron-specific handling
- Automatic environment detection (Tauri/Electron/Web)
- Smart proxy detection and fallback mechanisms
- Support for local file handling with `convertFileSrc`
- Comprehensive TypeScript types and interfaces
- Health check and stream info endpoints
- Configurable CORS, timeout, and redirect settings
- Examples for Tauri integration and standalone usage

### Features
- ✅ CORS bypass for external audio URLs
- ✅ Automatic proxy detection and usage
- ✅ Environment-specific URL handling
- ✅ Smart fallback to original URLs
- ✅ Retry mechanisms with configurable attempts
- ✅ Stream info and health check endpoints
- ✅ Support for redirects (podcasts, streaming URLs)
- ✅ TypeScript support with full type definitions
- ✅ ES modules and CommonJS builds
- ✅ Comprehensive documentation and examples

### Tested With
- Node.js 14+ ✅
- Tauri 1.x ✅
- Electron 20+ ✅
- Modern browsers ✅
- Various audio formats (MP3, OGG, WAV, etc.) ✅
- Podcast URLs with multiple redirects ✅
- Radio streaming URLs ✅

### Known Limitations
- Transcoding features planned for v1.1.0
- CLI tool planned for v1.1.0
- React/Vue hooks planned for v1.2.0