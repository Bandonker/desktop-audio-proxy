# Changelog

## [1.1.7] - 2026-02-06

### Added
- Comprehensive video streaming support (MP4, WebM, M3U8/HLS adaptive streaming)
- Video examples: `examples/video-streaming.js` with 6 complete examples
- React video player component: `examples/react-video-player.tsx` with basic, advanced, and playlist modes
- Video feature documentation in README with code examples and usage patterns

### Changed
- Expanded README with explicit video streaming feature documentation
- Updated package description to include video media support
- Enhanced package keywords to cover video formats (hls-streaming, m3u8-playlist, mp4-streaming, video-streaming)
- Improved gitignore to exclude generated maintenance artifacts and patch diffs

### Documentation
- Clarified universal media streaming capabilities (audio and video)
- Added dedicated "Video Streaming" section with MP4, M3U8/HLS, and seeking examples
- Updated problem/solution sections to address video codec and HLS challenges
- Documented range request support for video seeking

## [1.1.6] - 2025-10-21

### Fixed
- Added 'proxy_check' to TelemetryEvent type union (fixes TypeScript compilation errors)

## [1.1.5] - 2025-10-21

## [1.1.4] - 2025-10-21

### Added
- Tauri v2 support with automatic version detection (works with both v1 and v2)
- Auto-start proxy server option for Node.js environments
- Telemetry system for optional performance monitoring and debugging
- Debug logger with multi-level logging and category filtering
- Interactive telemetry dashboard demo
- JSDoc comments for better IDE autocomplete
- Security best practices guide (SECURITY.md)
- Tauri v2 migration guide (TAURI_MIGRATION.md)
- Performance benchmark suite

### Changed
- Improved error messages with actionable solutions
- Added `sideEffects: false` for better tree-shaking
- Enhanced TypeScript strict mode compliance

### Fixed
- Reserved keyword usage (renamed `debugger` to `debug`)
- Missing return statements in async route handlers
- TypeScript compilation warnings

### Notes
- No breaking changes, fully backward compatible
- For Tauri v2, set `withGlobalTauri: true` in tauri.conf.json
- See README for detailed feature documentation

## [1.1.1] - 2025-07-01

### Quality & Reliability Improvements

#### New Framework Integration Features
- **React Hooks Support**
  - `useAudioProxy()` - Complete audio URL processing with loading states
  - `useAudioCapabilities()` - System codec detection and device enumeration  
  - `useProxyStatus()` - Real-time proxy server monitoring
  - `useAudioMetadata()` - Audio file metadata extraction (Tauri/Electron)
  - `AudioProxyProvider` - Global configuration context provider
  - Full TypeScript support with comprehensive type definitions

- **Vue Composables Support**
  - `useAudioProxy()` - Reactive audio URL processing with Vue refs
  - `useAudioCapabilities()` - Reactive system capabilities detection
  - `useProxyStatus()` - Reactive proxy server status monitoring
  - `useAudioMetadata()` - Reactive metadata extraction (Tauri/Electron)
  - `createAudioProxy()` - Vue plugin for global configuration
  - Complete Vue 3 Composition API integration

- **Framework Integration Benefits**
  - One-line audio proxy integration for React/Vue applications
  - Automatic reactive state management for loading, errors, and data
  - Built-in retry mechanisms and error handling
  - Seamless integration with existing React/Vue projects
  - Optional peer dependencies - no framework lock-in
  - Comprehensive examples and usage patterns

#### Code Quality Enhancements
- **Enhanced TypeScript Type Safety**
  - Eliminated all explicit `any` warnings in core source files
  - Added comprehensive type declarations for Tauri and Electron APIs
  - Improved error handling with proper type checking throughout codebase
  - Added `ElectronAPI` and `TauriAPI` interfaces with full method signatures
  - Fixed Window interface conflicts between Tauri and Electron declarations

- **Improved Code Consistency**
  - Fixed all ESLint and Prettier formatting issues
  - Eliminated unused variable warnings in type declarations
  - Standardized error handling patterns across all modules
  - Enhanced code organization and documentation

### Framework Integration Examples

**React Hook Usage:**
```jsx
import { useAudioProxy, useAudioCapabilities } from 'desktop-audio-proxy/react';

function AudioPlayer({ url }) {
  const { audioUrl, isLoading, error, retry } = useAudioProxy(url);
  const { capabilities } = useAudioCapabilities();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error} <button onClick={retry}>Retry</button></div>;
  
  return <audio controls src={audioUrl} />;
}
```

**Vue Composable Usage:**
```vue
<script setup>
import { ref } from 'vue';
import { useAudioProxy, useAudioCapabilities } from 'desktop-audio-proxy/vue';

const url = ref('https://example.com/audio.mp3');
const { audioUrl, isLoading, error, retry } = useAudioProxy(url);
const { capabilities } = useAudioCapabilities();
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else-if="error">Error: {{ error }} <button @click="retry">Retry</button></div>
  <audio v-else controls :src="audioUrl" />
</template>
```


## [1.1.0] - 2025-06-30

### Added
- **Enhanced Tauri Integration** 
  - Real system audio info detection via `invoke('get_system_audio_info')`
  - Audio metadata extraction with `getAudioMetadata(filePath)` method
  - Audio device enumeration with `getAudioDevices()` method
  - Enhanced codec detection with system-level capabilities
  - Full Tauri backend communication integration

- **Enhanced Electron Integration** 
  - System audio info via `electronAPI.getSystemAudioInfo()`
  - Audio metadata extraction via `electronAPI.getAudioMetadata(filePath)`
  - Audio device enumeration via `electronAPI.getAudioDevices()`
  - System audio settings via `electronAPI.getSystemAudioSettings()`
  - Electron and Chromium version detection
  - Complete IPC integration for audio capabilities

- **Advanced Codec Detection** 
  - Comprehensive format testing (MP3, OGG, WAV, AAC, FLAC, WEBM, M4A)
  - Codec-specific testing with detailed capabilities mapping
  - Enhanced support reporting with granular codec information
  - Platform-specific codec enhancement integration

- **Improved URL Processing** 
  - Enhanced local file detection for `blob:` and `data:` URLs
  - Better Tauri `convertFileSrc` integration with error handling
  - Improved fallback mechanisms for file conversion failures

### Enhanced
- **Error Handling** - Comprehensive error handling and logging throughout all services
- **Type Safety** - Enhanced TypeScript types for all new methods and capabilities
- **Platform Integration** - Deep integration with platform-specific audio APIs

### Technical Improvements
- Enhanced system-level audio integration hooks
- Improved cross-platform compatibility and feature detection
- Optimized code structure

- **Interactive Demo** 
  - Comprehensive web demo with real library integration testing
  - Auto-detection of available package builds (local, CDN, various formats)
  - Dynamic version detection from proxy server health endpoint
  - Feature showcase for v1.1.0 capabilities (codec detection, metadata, devices)
  - Real-time CORS testing with direct URL vs proxy comparison
  - Enhanced debugging tools with exposed internals for manual testing
  - Visual upgrade guidance for users on older versions
  - Multiple version conflict detection and warnings

- **Professional CLI Demo** 
  - Terminal-based interface with professional ASCII art
  - Real-time system status matrix with live proxy detection
  - Interactive command system for URL testing and diagnostics
  - Automatic proxy server scanning across multiple ports (3002, 3001, 3003)
  - Smart user guidance with helpful tips when proxy is offline
  - Environment detection showing "Node.js CLI" for terminal usage

### Fixed
- **Version Detection** - Web and CLI demos now dynamically detect library version from proxy server
- **Proxy Status Detection** - Real-time proxy availability checking instead of hardcoded values
- **Multiple Version Handling** - Proper detection and warnings for conflicting installed versions

### Developer Experience
- Enhanced debugging with comprehensive logging
- Better error messages with context-specific information  
- Improved TypeScript IntelliSense with complete method signatures
- Platform-specific method availability based on environment detection
- Professional CLI interface for terminal-based testing and diagnostics
- Smart user guidance system with automatic helpful tips

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

