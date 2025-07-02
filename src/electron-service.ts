import { AudioProxyClient } from './client';
import { AudioServiceOptions } from './types';

// Type declarations for Electron API
interface ElectronAPI {
  getSystemAudioInfo?: () => Promise<{
    supportedFormats?: string[];
    systemInfo?: string;
  }>;
  getAudioMetadata?: (_filePath: string) => Promise<{
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
    format?: string;
  }>;
  getAudioDevices?: () => Promise<{
    inputDevices: Array<{ id: string; name: string }>;
    outputDevices: Array<{ id: string; name: string }>;
  }>;
  getSystemAudioSettings?: () => Promise<{
    defaultInputDevice?: string;
    defaultOutputDevice?: string;
    masterVolume?: number;
  }>;
}

// Extend the existing Window interface from client.ts - don't redeclare electronAPI

export class ElectronAudioService {
  private audioClient: AudioProxyClient;

  constructor(options: AudioServiceOptions = {}) {
    // Use audioOptions if provided, otherwise use the options directly
    const clientOptions = options.audioOptions || options;
    this.audioClient = new AudioProxyClient(clientOptions);
  }

  public async getStreamableUrl(url: string): Promise<string> {
    return await this.audioClient.getPlayableUrl(url);
  }

  public async canPlayStream(url: string) {
    return await this.audioClient.canPlayUrl(url);
  }

  public getEnvironment() {
    return this.audioClient.getEnvironment();
  }

  public async isProxyAvailable(): Promise<boolean> {
    return await this.audioClient.isProxyAvailable();
  }

  public async checkSystemCodecs(): Promise<{
    supportedFormats: string[];
    missingCodecs: string[];
    capabilities: Record<string, string>;
    electronVersion?: string;
    chromiumVersion?: string;
  }> {
    const audio = new Audio();
    const formats = [
      { name: 'MP3', mime: 'audio/mpeg', codecs: ['mp3'] },
      { name: 'OGG', mime: 'audio/ogg', codecs: ['vorbis', 'opus'] },
      { name: 'WAV', mime: 'audio/wav', codecs: ['pcm'] },
      { name: 'AAC', mime: 'audio/aac', codecs: ['mp4a.40.2'] },
      { name: 'FLAC', mime: 'audio/flac', codecs: ['flac'] },
      { name: 'WEBM', mime: 'audio/webm', codecs: ['vorbis', 'opus'] },
      { name: 'M4A', mime: 'audio/mp4', codecs: ['mp4a.40.2'] },
    ];

    const supportedFormats: string[] = [];
    const missingCodecs: string[] = [];
    const capabilities: Record<string, string> = {};

    for (const format of formats) {
      let bestSupport = '';
      let isSupported = false;

      // Test basic MIME type
      const basicSupport = audio.canPlayType(format.mime);
      capabilities[format.name + '_basic'] = basicSupport;

      if (basicSupport === 'probably' || basicSupport === 'maybe') {
        bestSupport = basicSupport;
        isSupported = true;
      }

      // Test with codecs
      for (const codec of format.codecs) {
        const codecSupport = audio.canPlayType(
          `${format.mime}; codecs="${codec}"`
        );
        capabilities[format.name + '_' + codec] = codecSupport;

        if (codecSupport === 'probably') {
          bestSupport = 'probably';
          isSupported = true;
        } else if (codecSupport === 'maybe' && bestSupport !== 'probably') {
          bestSupport = 'maybe';
          isSupported = true;
        }
      }

      capabilities[format.name] = bestSupport;

      if (isSupported) {
        supportedFormats.push(format.name);
      } else {
        missingCodecs.push(format.name);
      }
    }

    const result: {
      supportedFormats: string[];
      missingCodecs: string[];
      capabilities: Record<string, string>;
      electronVersion?: string;
      chromiumVersion?: string;
    } = { supportedFormats, missingCodecs, capabilities };

    // Add Electron version info if available
    if (this.getEnvironment() === 'electron') {
      try {
        if (typeof process !== 'undefined' && process.versions) {
          result.electronVersion = process.versions.electron;
          result.chromiumVersion = process.versions.chrome;
        }

        // Integrate with Electron main process for system codec detection
        const electronAPI = window.electronAPI as ElectronAPI | undefined;
        if (electronAPI?.getSystemAudioInfo) {
          try {
            const systemAudioInfo = await electronAPI.getSystemAudioInfo();
            if (systemAudioInfo) {
              capabilities['electron_system_info'] =
                JSON.stringify(systemAudioInfo);

              // Enhanced format support based on system capabilities
              if (systemAudioInfo.supportedFormats) {
                systemAudioInfo.supportedFormats.forEach((format: string) => {
                  if (!supportedFormats.includes(format)) {
                    supportedFormats.push(format);
                    // Remove from missing codecs if it was there
                    const missingIndex = missingCodecs.indexOf(format);
                    if (missingIndex > -1) {
                      missingCodecs.splice(missingIndex, 1);
                    }
                  }
                });
              }
            }
          } catch (error) {
            console.warn(
              '[ElectronAudioService] Failed to get system audio info via IPC:',
              error
            );
          }
        }
      } catch (error) {
        console.warn(
          '[ElectronAudioService] Could not access Electron version info:',
          error
        );
      }
    }

    return result;
  }

  // Electron-specific method to get audio file metadata via main process
  public async getAudioMetadata(filePath: string): Promise<{
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
    format?: string;
  } | null> {
    const electronAPI = window.electronAPI as ElectronAPI | undefined;
    if (
      this.getEnvironment() !== 'electron' ||
      !electronAPI?.getAudioMetadata
    ) {
      return null;
    }

    try {
      return await electronAPI.getAudioMetadata(filePath);
    } catch (error) {
      console.warn(
        '[ElectronAudioService] Failed to get audio metadata:',
        error
      );
      return null;
    }
  }

  // Electron-specific method to enumerate audio devices via main process
  public async getAudioDevices(): Promise<{
    inputDevices: Array<{ id: string; name: string }>;
    outputDevices: Array<{ id: string; name: string }>;
  } | null> {
    const electronAPI = window.electronAPI as ElectronAPI | undefined;
    if (this.getEnvironment() !== 'electron' || !electronAPI?.getAudioDevices) {
      return null;
    }

    try {
      return await electronAPI.getAudioDevices();
    } catch (error) {
      console.warn(
        '[ElectronAudioService] Failed to get audio devices:',
        error
      );
      return null;
    }
  }

  // Electron-specific method to get system audio settings
  public async getSystemAudioSettings(): Promise<{
    defaultInputDevice?: string;
    defaultOutputDevice?: string;
    masterVolume?: number;
  } | null> {
    const electronAPI = window.electronAPI as ElectronAPI | undefined;
    if (
      this.getEnvironment() !== 'electron' ||
      !electronAPI?.getSystemAudioSettings
    ) {
      return null;
    }

    try {
      return await electronAPI.getSystemAudioSettings();
    } catch (error) {
      console.warn(
        '[ElectronAudioService] Failed to get system audio settings:',
        error
      );
      return null;
    }
  }
}
