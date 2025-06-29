# Changelog

All notable changes to Desktop Audio Proxy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2025-06-29

### Added
- Comprehensive Jest test suite with TypeScript support
- ESLint and Prettier configuration for code quality
- GitHub Actions CI/CD pipeline with automated testing
- GitHub issue templates (bug report, feature request, question)
- GitHub pull request template for structured contributions
- Security policy with vulnerability reporting guidelines
- Electron-specific integration example with preload script patterns
- Code of conduct for community guidelines

### Changed
- Updated npm scripts to support Jest testing alongside legacy tests

### Developer Experience
- Added `npm run test:watch` for continuous testing during development
- Added `npm run test:coverage` for coverage reports
- Added `npm run lint:fix` for automatic code formatting
- Enhanced TypeScript configuration for better development experience

## [1.0.2] - 2025-06-29

### Fixed
- Minor bug fixes and stability improvements
- Updated dependencies to latest stable versions

## [1.0.1] - 2025-06-28

### Fixed
- Package.json export configuration
- TypeScript type definitions paths

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