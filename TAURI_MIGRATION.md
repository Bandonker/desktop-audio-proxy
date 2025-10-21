# Tauri v2 Migration Guide

This guide helps you migrate from Tauri v1 to v2 when using desktop-audio-proxy.

## The library automatically detects and works with both Tauri v1 and v2.

## What Changed in Tauri v2

Tauri v2 moved their JavaScript APIs to a new structure:

**Tauri v1:**
```javascript
window.__TAURI__.tauri.convertFileSrc()
window.__TAURI__.tauri.invoke()
```

**Tauri v2:**
```javascript
window.__TAURI__.core.convertFileSrc()
window.__TAURI__.core.invoke()
```

## How desktop-audio-proxy Handles This

The library checks for both API structures and uses whichever is available:

```typescript
// This works in both Tauri v1 and v2
import { TauriAudioService } from 'desktop-audio-proxy';

const audioService = new TauriAudioService();
const url = await audioService.getStreamableUrl('https://example.com/audio.mp3');
```

## Configuration Required for Tauri v2

Make sure your `tauri.conf.json` has this setting:

```json
{
  "app": {
    "withGlobalTauri": true
  }
}
```

This enables the global `window.__TAURI__` object that the library needs.

## Upgrading Steps

1. **Update Tauri dependencies** to v2
2. **Add `withGlobalTauri: true`** to your `tauri.conf.json`
3. **Update desktop-audio-proxy** to v1.1.4 or higher


## Verification

To verify everything is working:

```typescript
import { TauriAudioService } from 'desktop-audio-proxy';

const audioService = new TauriAudioService();

// This should return 'tauri' in both v1 and v2
console.log(audioService.getEnvironment());

// This should work with local files
const url = await audioService.getStreamableUrl('/path/to/audio.mp3');
console.log('Converted URL:', url);
```

## Troubleshooting

### Issue: `getEnvironment()` returns 'web' instead of 'tauri'

**Solution:**
1. Check that `withGlobalTauri: true` is in your `tauri.conf.json`
2. Verify `window.__TAURI__` exists in dev tools console
3. Make sure you're running in a Tauri app (not just a browser)

### Issue: Local files not playing

**Solution:**
- Tauri v2 requires file permissions in `tauri.conf.json`:

```json
{
  "tauri": {
    "allowlist": {
      "fs": {
        "scope": ["$AUDIO/**"]
      }
    }
  }
}
```

### Issue: "Failed to convert file source with Tauri"

**Cause:** This warning appears when the library can't find Tauri's `convertFileSrc` function.

**Solution:**
- Verify `window.__TAURI__.core` or `window.__TAURI__.tauri` exists
- Check that you're using desktop-audio-proxy v1.1.4+
- The library will still work, but may fall back to original URLs

## Breaking Changes from Tauri v1 → v2

**The library handles all API changesinternally**

## Version Compatibility Matrix

| desktop-audio-proxy | Tauri v1 | Tauri v2 |
|-------------------|----------|----------|
| < 1.1.4          | ✅       | ❌       |
| ≥ 1.1.4          | ✅       | ✅       |

## Example: Full Tauri v2 Setup

**tauri.conf.json:**
```json
{
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devPath": "http://localhost:5173",
    "distDir": "../dist"
  },
  "app": {
    "withGlobalTauri": true
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "fs": {
        "scope": ["$AUDIO/**"]
      }
    }
  }
}
```

**main.ts:**
```typescript
import { TauriAudioService } from 'desktop-audio-proxy';

// Works in both v1 and v2
const audioService = new TauriAudioService({
  autoDetect: true,
  fallbackToOriginal: true
});

// Convert and play
const playableUrl = await audioService.getStreamableUrl('https://podcast.example.com/episode.mp3');
document.querySelector('audio').src = playableUrl;
```
