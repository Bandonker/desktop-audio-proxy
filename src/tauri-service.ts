import { AudioProxyClient } from './client';
import { AudioServiceOptions } from './types';

// Type declarations for Tauri API that extends client.ts declarations

const CODEC_FORMATS = [
  { name: 'MP3', mime: 'audio/mpeg', codecs: ['mp3'] },
  { name: 'OGG', mime: 'audio/ogg', codecs: ['vorbis', 'opus'] },
  { name: 'WAV', mime: 'audio/wav', codecs: ['pcm'] },
  { name: 'AAC', mime: 'audio/aac', codecs: ['mp4a.40.2'] },
  { name: 'FLAC', mime: 'audio/flac', codecs: ['flac'] },
  { name: 'WEBM', mime: 'audio/webm', codecs: ['vorbis', 'opus'] },
  { name: 'M4A', mime: 'audio/mp4', codecs: ['mp4a.40.2'] },
] as const;

function isSupportedResult(result: string): boolean {
  return result === 'probably' || result === 'maybe';
}

function mergeSupportedFormat(
  format: string,
  supportedFormats: string[],
  missingCodecs: string[]
): void {
  if (!supportedFormats.includes(format)) {
    supportedFormats.push(format);
    const missingIndex = missingCodecs.indexOf(format);
    if (missingIndex > -1) {
      missingCodecs.splice(missingIndex, 1);
    }
  }
}

export class TauriAudioService {
  private audioClient: AudioProxyClient;

  constructor(options: AudioServiceOptions = {}) {
    // Use audioOptions if provided, otherwise use the options directly
    const clientOptions = options.audioOptions || options;
    this.audioClient = new AudioProxyClient(clientOptions);
  }

  public async getStreamableUrl(url: string): Promise<string> {
    return this.audioClient.getPlayableUrl(url);
  }

  public async canPlayStream(url: string) {
    return this.audioClient.canPlayUrl(url);
  }

  public getEnvironment() {
    return this.audioClient.getEnvironment();
  }

  public async isProxyAvailable(): Promise<boolean> {
    return this.audioClient.isProxyAvailable();
  }

  private getTauriInvoke() {
    const tauri = window.__TAURI__;
    if (!tauri) {
      return null;
    }

    return tauri.core?.invoke || tauri.tauri?.invoke || null;
  }

  public async checkSystemCodecs(): Promise<{
    supportedFormats: string[];
    missingCodecs: string[];
    capabilities: Record<string, string>;
  }> {
    const audio = new Audio();

    const supportedFormats: string[] = [];
    const missingCodecs: string[] = [];
    const capabilities: Record<string, string> = {};

    for (const format of CODEC_FORMATS) {
      let bestSupport = '';
      let isSupported = false;

      // Test basic MIME type
      const basicSupport = audio.canPlayType(format.mime);
      capabilities[`${format.name}_basic`] = basicSupport;

      if (isSupportedResult(basicSupport)) {
        bestSupport = basicSupport;
        isSupported = true;
      }

      // Test with codecs
      for (const codec of format.codecs) {
        const codecSupport = audio.canPlayType(
          `${format.mime}; codecs="${codec}"`
        );
        capabilities[`${format.name}_${codec}`] = codecSupport;

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

    // Check for additional Tauri-specific audio capabilities if available
    if (this.getEnvironment() === 'tauri' && window.__TAURI__) {
      try {
        // Try Tauri v2 API first, fallback to v1
        const invoke = this.getTauriInvoke();

        if (!invoke) {
          throw new Error('Tauri invoke not available');
        }

        // Try to get system audio info from Tauri backend
        const systemAudioInfo = await invoke('get_system_audio_info').catch(
          () => null
        );
        if (systemAudioInfo && typeof systemAudioInfo === 'object') {
          capabilities['tauri_system_info'] = JSON.stringify(systemAudioInfo);

          // Enhanced format support based on system capabilities
          const audioInfo = systemAudioInfo as { supportedFormats?: string[] };
          if (audioInfo.supportedFormats) {
            audioInfo.supportedFormats.forEach((format: string) => {
              mergeSupportedFormat(format, supportedFormats, missingCodecs);
            });
          }
        }
      } catch (error) {
        console.warn(
          '[TauriAudioService] Could not access Tauri backend for codec detection:',
          error
        );
      }
    }

    return { supportedFormats, missingCodecs, capabilities };
  }

  // Tauri-specific method to get audio file metadata
  public async getAudioMetadata(filePath: string): Promise<{
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
    format?: string;
  } | null> {
    if (this.getEnvironment() !== 'tauri' || !window.__TAURI__) {
      return null;
    }

    try {
      const invoke = this.getTauriInvoke();
      if (!invoke) {
        throw new Error('Tauri invoke not available');
      }

      const result = await invoke('get_audio_metadata', { path: filePath });
      return result as {
        duration?: number;
        bitrate?: number;
        sampleRate?: number;
        channels?: number;
        format?: string;
      } | null;
    } catch (error) {
      console.warn('[TauriAudioService] Failed to get audio metadata:', error);
      return null;
    }
  }

  // Tauri-specific method to enumerate audio devices
  public async getAudioDevices(): Promise<{
    inputDevices: Array<{ id: string; name: string }>;
    outputDevices: Array<{ id: string; name: string }>;
  } | null> {
    if (this.getEnvironment() !== 'tauri' || !window.__TAURI__) {
      return null;
    }

    try {
      const invoke = this.getTauriInvoke();
      if (!invoke) {
        throw new Error('Tauri invoke not available');
      }

      const result = await invoke('get_audio_devices');
      return result as {
        inputDevices: Array<{ id: string; name: string }>;
        outputDevices: Array<{ id: string; name: string }>;
      } | null;
    } catch (error) {
      console.warn('[TauriAudioService] Failed to get audio devices:', error);
      return null;
    }
  }
}
