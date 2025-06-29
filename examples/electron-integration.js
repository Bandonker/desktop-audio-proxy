/**
 * Example: Integrating Desktop Audio Proxy with an Electron app
 * This demonstrates Electron-specific setup and usage patterns
 */

// Main Process (main.js)
// ===================

// In your main Electron process, you can start the proxy server
import { app, BrowserWindow } from 'electron';
import { startProxyServer } from 'desktop-audio-proxy/server';

let mainWindow;
let proxyServer;

async function createWindow() {
  // Start the proxy server in development
  if (process.env.NODE_ENV === 'development') {
    try {
      proxyServer = await startProxyServer({ 
        port: 3001,
        enableLogging: true,
        cors: {
          origin: true, // Allow all origins in development
          credentials: true
        }
      });
      console.log('🎵 Audio proxy server started on port 3001');
    } catch (error) {
      console.error('Failed to start proxy server:', error);
    }
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // Security best practice
      contextIsolation: true, // Security best practice
      preload: path.join(__dirname, 'preload.js')
    }
  });

  await mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('before-quit', () => {
  if (proxyServer) {
    proxyServer.close();
  }
});

// Preload Script (preload.js)
// ===========================

// Expose safe APIs to the renderer process
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Audio-related APIs
  isElectron: () => true,
  getAppVersion: () => process.versions.electron,
  
  // System information that might be useful for audio handling
  platform: process.platform,
  arch: process.arch,
  
  // IPC for advanced audio operations if needed
  requestSystemAudioInfo: () => ipcRenderer.invoke('get-system-audio-info'),
  
  // Path utilities for local files
  resolvePath: (relativePath) => ipcRenderer.invoke('resolve-path', relativePath)
});

// Renderer Process (renderer.js)
// ==============================

// Import the Electron-specific audio service
import { ElectronAudioService } from 'desktop-audio-proxy';

// Initialize the service with Electron-specific options
const audioService = new ElectronAudioService({
  audioOptions: {
    proxyUrl: 'http://localhost:3001',
    autoDetect: true,
    fallbackToOriginal: true,
    retryAttempts: 3,
    // Electron-specific configuration
    proxyConfig: {
      userAgent: `MyElectronApp/${window.electronAPI?.getAppVersion() || '1.0.0'}`,
      timeout: 10000
    }
  }
});

// Example: Audio player component for Electron
class ElectronAudioPlayer {
  constructor() {
    this.audioElement = new Audio();
    this.currentTrack = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.audioElement.addEventListener('loadstart', () => {
      console.log('[ElectronAudio] Loading started');
    });

    this.audioElement.addEventListener('canplay', () => {
      console.log('[ElectronAudio] Can start playing');
    });

    this.audioElement.addEventListener('error', (e) => {
      console.error('[ElectronAudio] Playback error:', e);
    });
  }

  async playTrack(track) {
    console.log('[ElectronAudio] Playing track:', track.title);
    
    try {
      // Check system codec support first (Electron-specific feature)
      const codecInfo = await audioService.checkSystemCodecs();
      console.log('[ElectronAudio] Supported formats:', codecInfo.supportedFormats);
      
      if (codecInfo.missingCodecs.length > 0) {
        console.warn('[ElectronAudio] Missing codecs:', codecInfo.missingCodecs);
      }

      // Get streamable URL through the proxy
      const streamableUrl = await audioService.getStreamableUrl(track.url);
      console.log('[ElectronAudio] Using streamable URL:', streamableUrl);

      // Set the audio source and play
      this.audioElement.src = streamableUrl;
      this.currentTrack = track;
      
      await this.audioElement.play();
      console.log('[ElectronAudio] Playback started successfully');
      
    } catch (error) {
      console.error('[ElectronAudio] Failed to play track:', error);
      
      // Electron-specific error handling
      if (error.name === 'NotSupportedError') {
        this.showCodecError(track);
      } else if (error.name === 'NetworkError') {
        this.showNetworkError(track);
      }
    }
  }

  async checkStreamHealth(url) {
    try {
      const canPlay = await audioService.canPlayStream(url);
      const environment = audioService.getEnvironment();
      const proxyAvailable = await audioService.isProxyAvailable();
      
      return {
        canPlay,
        environment,
        proxyAvailable,
        electronVersion: window.electronAPI?.getAppVersion()
      };
    } catch (error) {
      console.error('[ElectronAudio] Health check failed:', error);
      return { canPlay: false, error: error.message };
    }
  }

  showCodecError(track) {
    // Electron-specific: Could show native dialog
    console.error(`Codec not supported for ${track.title}. Consider installing additional codecs.`);
  }

  showNetworkError(track) {
    console.error(`Network error playing ${track.title}. Check your connection and proxy settings.`);
  }
}

// Example: Radio streaming with Electron-specific features
export const playElectronRadio = async (station) => {
  const player = new ElectronAudioPlayer();
  
  try {
    // Check if we're in Electron and proxy is available
    const healthCheck = await player.checkStreamHealth(station.url);
    
    if (!healthCheck.canPlay) {
      throw new Error(`Cannot play ${station.name}: ${healthCheck.error || 'Unknown error'}`);
    }
    
    console.log('[ElectronAudio] Environment check:', healthCheck);
    
    const radioTrack = {
      id: `radio-${station.id}`,
      title: `🔴 LIVE: ${station.name}`,
      artist: station.description,
      album: `${station.genre} Radio`,
      url: station.url,
      isLive: true
    };

    await player.playTrack(radioTrack);
    
  } catch (error) {
    console.error('[ElectronAudio] Failed to play radio station:', error);
  }
};

// Example: Handling local files in Electron
export const playLocalFile = async (filePath) => {
  try {
    // Electron can access local files directly, but we still might want proxy for consistency
    const resolvedPath = await window.electronAPI?.resolvePath(filePath);
    const fileUrl = `file://${resolvedPath}`;
    
    const player = new ElectronAudioPlayer();
    await player.playTrack({
      id: `local-${Date.now()}`,
      title: path.basename(filePath),
      artist: 'Local File',
      url: fileUrl,
      isLocal: true
    });
    
  } catch (error) {
    console.error('[ElectronAudio] Failed to play local file:', error);
  }
};

// Example: Electron-specific initialization
export const initializeElectronAudio = async () => {
  console.log('[ElectronAudio] Initializing audio system...');
  
  // Verify we're in Electron
  if (!window.electronAPI) {
    throw new Error('This example requires Electron environment');
  }
  
  const environment = audioService.getEnvironment();
  console.log('[ElectronAudio] Detected environment:', environment);
  
  // Check codec support
  const codecInfo = await audioService.checkSystemCodecs();
  console.log('[ElectronAudio] System codec support:', codecInfo);
  
  // Check proxy availability
  const proxyAvailable = await audioService.isProxyAvailable();
  console.log('[ElectronAudio] Proxy server available:', proxyAvailable);
  
  return {
    environment,
    codecInfo,
    proxyAvailable,
    electronVersion: window.electronAPI.getAppVersion(),
    platform: window.electronAPI.platform
  };
};

// Export the service for use in other modules
export { audioService };