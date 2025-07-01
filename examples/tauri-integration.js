/**
 * Example: Integrating Desktop Audio Proxy with a Tauri app
 * This shows how to replace the existing audio proxy solution in SoundWave
 */

// Before: Using custom proxy service
// import audioProxyService from '../services/audioProxyService';
// const url = await audioProxyService.getPlayableUrl(originalUrl);

// After: Using Desktop Audio Proxy library
import { TauriAudioService } from 'desktop-audio-proxy';

// Initialize the service
const audioService = new TauriAudioService({
  audioOptions: {
    proxyUrl: 'http://localhost:3002',
    autoDetect: true,
    fallbackToOriginal: true,
    retryAttempts: 3
  }
});

// Example usage in your audio player hook
export const useAudioPlayerWithProxy = (externalAudioRef) => {
  // ... other hook code ...

  const playTrack = useCallback(async (track) => {
    console.log('[AudioPlayer] Playing track:', track.title);
    
    if (!audioRef.current) {
      console.error('[AudioPlayer] No audio element available');
      return;
    }

    let url = track.url || track.fileUrl;
    
    if (!url) {
      console.error('[AudioPlayer] Track has no URL');
      return;
    }

    // Use Desktop Audio Proxy to get playable URL
    try {
      url = await audioService.getStreamableUrl(url);
      console.log('[AudioPlayer] Using streamable URL:', url);
    } catch (error) {
      console.error('[AudioPlayer] Failed to get streamable URL:', error);
      return;
    }

    // Set the audio source
    audioRef.current.src = url;
    
    // Rest of your playback logic...
    try {
      await audioRef.current.play();
      console.log('[AudioPlayer] Playback started successfully');
    } catch (error) {
      console.error('[AudioPlayer] Playback failed:', error);
    }
    
  }, [audioRef]);

  return {
    playTrack,
    // ... other returns
  };
};

// Example: Starting proxy server alongside your app
import { startProxyServer } from 'desktop-audio-proxy';

async function initializeApp() {
  // Start proxy server in development
  if (import.meta.env.DEV) {
    try {
      await startProxyServer({ 
        port: 3002,
        enableLogging: true 
      });
      console.log('🎵 Audio proxy server started');
    } catch (error) {
      console.error('Failed to start proxy server:', error);
    }
  }

  // Initialize your app...
}

// Example: Radio station handling
export const playRadioStation = async (station) => {
  try {
    // Get streamable URL for radio station
    const streamUrl = await audioService.getStreamableUrl(station.url);
    
    // Create track object
    const radioTrack = {
      id: `radio-${station.id}`,
      title: `🔴 LIVE: ${station.name}`,
      artist: station.description,
      album: `${station.genre} Radio`,
      year: new Date().getFullYear(),
      duration: 0,
      genre: station.genre,
      url: streamUrl,
      addedAt: new Date()
    };

    // Play the track
    playTrack(radioTrack);
  } catch (error) {
    console.error('Failed to play radio station:', error);
  }
};

// Example: Environment-specific handling with v1.1.0 features
export const getEnvironmentConfig = async () => {
  const environment = audioService.getEnvironment();
  
  // v1.1.0: Enhanced codec detection
  const codecSupport = await audioService.checkSystemCodecs().catch(() => ({}));
  
  // v1.1.0: Audio device enumeration (Tauri-specific)
  const audioDevices = environment === 'tauri' ? 
    await audioService.getAudioDevices().catch(() => []) : [];
  
  return {
    environment,
    needsProxy: environment === 'web' || window.location.hostname === 'localhost',
    proxyUrl: 'http://localhost:3002',
    autoStart: environment === 'tauri' && import.meta.env.DEV,
    
    // v1.1.0 features
    codecSupport,
    audioDevices,
    hasEnhancedFeatures: true
  };
};