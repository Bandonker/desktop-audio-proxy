
import { AudioProxyClient } from './client';
import { AudioServiceOptions } from './types';

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

  // Electron-specific methods can be added here
  public async checkSystemCodecs(): Promise<{ supportedFormats: string[], missingCodecs: string[] }> {
    // This would integrate with Electron's main process to check installed codecs
    // For now, return a mock implementation
    const audio = new Audio();
    const formats = [
      { name: 'MP3', mime: 'audio/mpeg' },
      { name: 'OGG', mime: 'audio/ogg' },
      { name: 'WAV', mime: 'audio/wav' },
      { name: 'AAC', mime: 'audio/aac' },
      { name: 'FLAC', mime: 'audio/flac' },
      { name: 'WEBM', mime: 'audio/webm' }
    ];

    const supportedFormats: string[] = [];
    const missingCodecs: string[] = [];

    formats.forEach(format => {
      const canPlay = audio.canPlayType(format.mime);
      if (canPlay === 'probably' || canPlay === 'maybe') {
        supportedFormats.push(format.name);
      } else {
        missingCodecs.push(format.name);
      }
    });

    return { supportedFormats, missingCodecs };
  }
}