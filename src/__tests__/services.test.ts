import { TauriAudioService } from '../tauri-service';
import { ElectronAudioService } from '../electron-service';

// Mock the AudioProxyClient
jest.mock('../client');

type InternalAudioClient = {
  getPlayableUrl: jest.Mock;
  canPlayUrl: jest.Mock;
  getEnvironment: jest.Mock;
  isProxyAvailable: jest.Mock;
};

type TestWindow = {
  __TAURI__?: {
    tauri?: {
      invoke: jest.Mock;
    };
    core?: {
      invoke: jest.Mock;
    };
  };
  electronAPI?: {
    getSystemAudioInfo?: jest.Mock;
    getAudioMetadata?: jest.Mock;
    getAudioDevices?: jest.Mock;
    getSystemAudioSettings?: jest.Mock;
  };
};

type TestGlobalState = {
  window: TestWindow;
  process: {
    versions?: {
      electron?: string;
      chrome?: string;
    };
  };
};

function getTestGlobalState(): TestGlobalState {
  return globalThis as unknown as TestGlobalState;
}

function getAudioClient(
  service: TauriAudioService | ElectronAudioService
): InternalAudioClient {
  return (service as unknown as { audioClient: InternalAudioClient })
    .audioClient;
}

describe('Audio Services', () => {
  describe('TauriAudioService', () => {
    let service: TauriAudioService;

    beforeEach(() => {
      service = new TauriAudioService({
        audioOptions: {
          proxyUrl: 'http://localhost:3001',
          autoDetect: true,
        },
      });
    });

    it('should initialize with default options', () => {
      const defaultService = new TauriAudioService();
      expect(defaultService).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const customService = new TauriAudioService({
        audioOptions: {
          proxyUrl: 'http://custom:8080',
          retryAttempts: 5,
        },
      });
      expect(customService).toBeDefined();
    });

    it('should handle legacy options format', () => {
      const legacyService = new TauriAudioService({
        proxyUrl: 'http://legacy:3001',
      });
      expect(legacyService).toBeDefined();
    });

    describe('getStreamableUrl', () => {
      it('should delegate to AudioProxyClient', async () => {
        const mockUrl = 'https://example.com/audio.mp3';
        const expectedUrl =
          'http://localhost:3001/stream?url=' + encodeURIComponent(mockUrl);

        // Mock the client method
        const mockGetPlayableUrl = jest.fn().mockResolvedValue(expectedUrl);
        getAudioClient(service).getPlayableUrl = mockGetPlayableUrl;

        const result = await service.getStreamableUrl(mockUrl);

        expect(mockGetPlayableUrl).toHaveBeenCalledWith(mockUrl);
        expect(result).toBe(expectedUrl);
      });

      it('should handle errors gracefully', async () => {
        const mockUrl = 'https://example.com/audio.mp3';

        const mockGetPlayableUrl = jest
          .fn()
          .mockRejectedValue(new Error('Network error'));
        getAudioClient(service).getPlayableUrl = mockGetPlayableUrl;

        await expect(service.getStreamableUrl(mockUrl)).rejects.toThrow(
          'Network error'
        );
      });
    });

    describe('canPlayStream', () => {
      it('should delegate to AudioProxyClient', async () => {
        const mockUrl = 'https://example.com/audio.mp3';

        const mockCanPlayUrl = jest.fn().mockResolvedValue(true);
        getAudioClient(service).canPlayUrl = mockCanPlayUrl;

        const result = await service.canPlayStream(mockUrl);

        expect(mockCanPlayUrl).toHaveBeenCalledWith(mockUrl);
        expect(result).toBe(true);
      });
    });

    describe('Environment detection', () => {
      it('should expose environment detection', () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('tauri');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        const env = service.getEnvironment();

        expect(mockGetEnvironment).toHaveBeenCalled();
        expect(env).toBe('tauri');
      });
    });

    describe('isProxyAvailable', () => {
      it('should check proxy availability', async () => {
        const mockIsProxyAvailable = jest.fn().mockResolvedValue(true);
        getAudioClient(service).isProxyAvailable = mockIsProxyAvailable;

        const isAvailable = await service.isProxyAvailable();

        expect(mockIsProxyAvailable).toHaveBeenCalled();
        expect(isAvailable).toBe(true);
      });
    });

    describe('checkSystemCodecs', () => {
      beforeEach(() => {
        // Mock Audio constructor for codec checking
        global.Audio = jest.fn().mockImplementation(() => ({
          canPlayType: jest.fn((type: string) => {
            if (type.includes('audio/mpeg') || type.includes('mp3'))
              return 'probably';
            if (type.includes('audio/wav') || type.includes('pcm'))
              return 'probably';
            if (type.includes('audio/ogg') || type.includes('vorbis'))
              return 'maybe';
            return '';
          }),
        }));
      });

      it('should return supported and missing codecs with capabilities', async () => {
        const codecInfo = await service.checkSystemCodecs();

        expect(codecInfo).toHaveProperty('supportedFormats');
        expect(codecInfo).toHaveProperty('missingCodecs');
        expect(codecInfo).toHaveProperty('capabilities');
        expect(Array.isArray(codecInfo.supportedFormats)).toBe(true);
        expect(Array.isArray(codecInfo.missingCodecs)).toBe(true);
        expect(typeof codecInfo.capabilities).toBe('object');
      });

      it('should correctly identify supported formats', async () => {
        const codecInfo = await service.checkSystemCodecs();

        expect(codecInfo.supportedFormats).toContain('MP3');
        expect(codecInfo.supportedFormats).toContain('WAV');
        expect(codecInfo.supportedFormats).toContain('OGG');
        expect(codecInfo.capabilities).toHaveProperty('MP3');
        expect(codecInfo.capabilities).toHaveProperty('WAV');
        expect(codecInfo.capabilities).toHaveProperty('OGG');
      });

      it('should handle Tauri environment with system audio info', async () => {
        // Mock Tauri environment
        const mockGetEnvironment = jest.fn().mockReturnValue('tauri');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        // Mock Tauri API
        getTestGlobalState().window = {
          __TAURI__: {
            tauri: {
              invoke: jest.fn().mockResolvedValue({
                supportedFormats: ['MP3', 'FLAC', 'AAC'],
                systemInfo: 'Linux Audio System',
              }),
            },
          },
        };

        const codecInfo = await service.checkSystemCodecs();

        expect(codecInfo.supportedFormats).toContain('FLAC');
        expect(codecInfo.supportedFormats).toContain('AAC');
        expect(codecInfo.capabilities).toHaveProperty('tauri_system_info');
      });

      it('should handle Tauri environment without system audio info', async () => {
        // Mock Tauri environment
        const mockGetEnvironment = jest.fn().mockReturnValue('tauri');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        // Mock Tauri API that returns null (caught error case)
        getTestGlobalState().window = {
          __TAURI__: {
            tauri: {
              invoke: jest
                .fn()
                .mockReturnValue(Promise.resolve(null).catch(() => null)),
            },
          },
        };

        const codecInfo = await service.checkSystemCodecs();

        expect(codecInfo.supportedFormats).toContain('MP3');
        expect(codecInfo.capabilities).not.toHaveProperty('tauri_system_info');
      });

      it('should handle non-Tauri environment', async () => {
        // Mock non-Tauri environment
        const mockGetEnvironment = jest.fn().mockReturnValue('web');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        const codecInfo = await service.checkSystemCodecs();

        expect(codecInfo.supportedFormats).toContain('MP3');
        expect(codecInfo.capabilities).not.toHaveProperty('tauri_system_info');
      });
    });

    describe('getAudioMetadata', () => {
      it('should return null for non-Tauri environment', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('web');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        const metadata = await service.getAudioMetadata('/path/to/audio.mp3');

        expect(metadata).toBeNull();
      });

      it('should return null when Tauri API is not available', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('tauri');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        getTestGlobalState().window = {};

        const metadata = await service.getAudioMetadata('/path/to/audio.mp3');

        expect(metadata).toBeNull();
      });

      it('should return metadata for Tauri environment', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('tauri');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        const mockMetadata = {
          duration: 180.5,
          bitrate: 320,
          sampleRate: 44100,
          channels: 2,
          format: 'MP3',
        };

        getTestGlobalState().window = {
          __TAURI__: {
            tauri: {
              invoke: jest.fn().mockResolvedValue(mockMetadata),
            },
          },
        };

        const metadata = await service.getAudioMetadata('/path/to/audio.mp3');

        expect(metadata).toEqual(mockMetadata);
        expect(
          getTestGlobalState().window.__TAURI__!.tauri!.invoke
        ).toHaveBeenCalledWith('get_audio_metadata', {
          path: '/path/to/audio.mp3',
        });
      });

      it('should handle errors gracefully', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('tauri');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        getTestGlobalState().window = {
          __TAURI__: {
            tauri: {
              invoke: jest.fn().mockRejectedValue(new Error('File not found')),
            },
          },
        };

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const metadata = await service.getAudioMetadata('/path/to/invalid.mp3');

        expect(metadata).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[TauriAudioService] Failed to get audio metadata:',
          expect.any(Error)
        );

        consoleWarnSpy.mockRestore();
      });
    });

    describe('getAudioDevices', () => {
      it('should return null for non-Tauri environment', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('web');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        const devices = await service.getAudioDevices();

        expect(devices).toBeNull();
      });

      it('should return null when Tauri API is not available', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('tauri');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        getTestGlobalState().window = {};

        const devices = await service.getAudioDevices();

        expect(devices).toBeNull();
      });

      it('should return audio devices for Tauri environment', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('tauri');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        const mockDevices = {
          inputDevices: [
            { id: 'input1', name: 'Built-in Microphone' },
            { id: 'input2', name: 'USB Microphone' },
          ],
          outputDevices: [
            { id: 'output1', name: 'Built-in Speakers' },
            { id: 'output2', name: 'Bluetooth Headphones' },
          ],
        };

        getTestGlobalState().window = {
          __TAURI__: {
            tauri: {
              invoke: jest.fn().mockResolvedValue(mockDevices),
            },
          },
        };

        const devices = await service.getAudioDevices();

        expect(devices).toEqual(mockDevices);
        expect(
          getTestGlobalState().window.__TAURI__!.tauri!.invoke
        ).toHaveBeenCalledWith('get_audio_devices');
      });

      it('should handle errors gracefully', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('tauri');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        getTestGlobalState().window = {
          __TAURI__: {
            tauri: {
              invoke: jest
                .fn()
                .mockRejectedValue(new Error('Audio system unavailable')),
            },
          },
        };

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const devices = await service.getAudioDevices();

        expect(devices).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[TauriAudioService] Failed to get audio devices:',
          expect.any(Error)
        );

        consoleWarnSpy.mockRestore();
      });
    });
  });

  describe('ElectronAudioService', () => {
    let service: ElectronAudioService;

    beforeEach(() => {
      service = new ElectronAudioService({
        audioOptions: {
          proxyUrl: 'http://localhost:3001',
          autoDetect: true,
        },
      });

      // Mock Audio constructor for codec checking
      global.Audio = jest.fn().mockImplementation(() => ({
        canPlayType: jest.fn((type: string) => {
          const supportedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg'];
          return supportedTypes.includes(type) ? 'probably' : '';
        }),
      }));
    });

    it('should initialize with default options', () => {
      const defaultService = new ElectronAudioService();
      expect(defaultService).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const customService = new ElectronAudioService({
        audioOptions: {
          proxyUrl: 'http://custom:8080',
          retryAttempts: 5,
        },
      });
      expect(customService).toBeDefined();
    });

    describe('getStreamableUrl', () => {
      it('should delegate to AudioProxyClient', async () => {
        const mockUrl = 'https://example.com/audio.mp3';
        const expectedUrl =
          'http://localhost:3001/stream?url=' + encodeURIComponent(mockUrl);

        const mockGetPlayableUrl = jest.fn().mockResolvedValue(expectedUrl);
        getAudioClient(service).getPlayableUrl = mockGetPlayableUrl;

        const result = await service.getStreamableUrl(mockUrl);

        expect(mockGetPlayableUrl).toHaveBeenCalledWith(mockUrl);
        expect(result).toBe(expectedUrl);
      });
    });

    describe('checkSystemCodecs', () => {
      it('should return supported and missing codecs with capabilities', async () => {
        const codecInfo = await service.checkSystemCodecs();

        expect(codecInfo).toHaveProperty('supportedFormats');
        expect(codecInfo).toHaveProperty('missingCodecs');
        expect(codecInfo).toHaveProperty('capabilities');
        expect(Array.isArray(codecInfo.supportedFormats)).toBe(true);
        expect(Array.isArray(codecInfo.missingCodecs)).toBe(true);
        expect(typeof codecInfo.capabilities).toBe('object');
      });

      it('should correctly identify supported formats', async () => {
        const codecInfo = await service.checkSystemCodecs();

        expect(codecInfo.supportedFormats).toContain('MP3');
        expect(codecInfo.supportedFormats).toContain('WAV');
        expect(codecInfo.supportedFormats).toContain('OGG');
        expect(codecInfo.capabilities).toHaveProperty('MP3');
        expect(codecInfo.capabilities).toHaveProperty('WAV');
        expect(codecInfo.capabilities).toHaveProperty('OGG');
      });

      it('should correctly identify missing codecs', async () => {
        const codecInfo = await service.checkSystemCodecs();

        expect(codecInfo.missingCodecs).toContain('AAC');
        expect(codecInfo.missingCodecs).toContain('FLAC');
        expect(codecInfo.missingCodecs).toContain('WEBM');
        expect(codecInfo.capabilities).toHaveProperty('AAC');
        expect(codecInfo.capabilities).toHaveProperty('FLAC');
        expect(codecInfo.capabilities).toHaveProperty('WEBM');
      });

      it('should include electron version info when available', async () => {
        // Mock the getEnvironment method to return 'electron'
        const mockGetEnvironment = jest.fn().mockReturnValue('electron');
        jest
          .spyOn(service, 'getEnvironment')
          .mockImplementation(mockGetEnvironment);

        // Mock process.versions for electron
        getTestGlobalState().process = {
          versions: {
            electron: '25.0.0',
            chrome: '114.0.0',
          },
        };

        const codecInfo = await service.checkSystemCodecs();

        expect(codecInfo).toHaveProperty('electronVersion');
        expect(codecInfo).toHaveProperty('chromiumVersion');
        expect(codecInfo).toHaveProperty('capabilities');
        expect(codecInfo.electronVersion).toBe('25.0.0');
        expect(codecInfo.chromiumVersion).toBe('114.0.0');
      });
    });

    describe('canPlayStream', () => {
      it('should delegate to AudioProxyClient', async () => {
        const mockUrl = 'https://example.com/audio.mp3';

        const mockCanPlayUrl = jest.fn().mockResolvedValue(true);
        getAudioClient(service).canPlayUrl = mockCanPlayUrl;

        const result = await service.canPlayStream(mockUrl);

        expect(mockCanPlayUrl).toHaveBeenCalledWith(mockUrl);
        expect(result).toBe(true);
      });
    });

    describe('Environment detection', () => {
      it('should expose environment detection', () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('electron');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        const env = service.getEnvironment();

        expect(mockGetEnvironment).toHaveBeenCalled();
        expect(env).toBe('electron');
      });
    });

    describe('isProxyAvailable', () => {
      it('should check proxy availability', async () => {
        const mockIsProxyAvailable = jest.fn().mockResolvedValue(true);
        getAudioClient(service).isProxyAvailable = mockIsProxyAvailable;

        const isAvailable = await service.isProxyAvailable();

        expect(mockIsProxyAvailable).toHaveBeenCalled();
        expect(isAvailable).toBe(true);
      });
    });

    describe('checkSystemCodecs - enhanced features', () => {
      it('should include system info when electronAPI is available', async () => {
        // Mock Electron environment
        const mockGetEnvironment = jest.fn().mockReturnValue('electron');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        // Mock electronAPI
        getTestGlobalState().window = {
          electronAPI: {
            getSystemAudioInfo: jest.fn().mockResolvedValue({
              supportedFormats: ['FLAC', 'OPUS'],
              systemInfo: 'Windows Audio System',
            }),
          },
        };

        const codecInfo = await service.checkSystemCodecs();

        expect(codecInfo.supportedFormats).toContain('FLAC');
        expect(codecInfo.supportedFormats).toContain('OPUS');
        expect(codecInfo.capabilities).toHaveProperty('electron_system_info');
      });

      it('should handle electronAPI errors gracefully', async () => {
        // Mock Electron environment
        const mockGetEnvironment = jest.fn().mockReturnValue('electron');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        // Mock electronAPI that fails
        getTestGlobalState().window = {
          electronAPI: {
            getSystemAudioInfo: jest
              .fn()
              .mockRejectedValue(new Error('IPC error')),
          },
        };

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const codecInfo = await service.checkSystemCodecs();

        expect(codecInfo.supportedFormats).toContain('MP3');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[ElectronAudioService] Failed to get system audio info via IPC:',
          expect.any(Error)
        );

        consoleWarnSpy.mockRestore();
      });

      it('should handle missing electronAPI gracefully', async () => {
        // Mock Electron environment
        const mockGetEnvironment = jest.fn().mockReturnValue('electron');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        // No electronAPI available
        getTestGlobalState().window = {};

        const codecInfo = await service.checkSystemCodecs();

        expect(codecInfo.supportedFormats).toContain('MP3');
        expect(codecInfo.capabilities).not.toHaveProperty(
          'electron_system_info'
        );
      });

      it('should handle non-electron environment', async () => {
        // Mock non-electron environment
        const mockGetEnvironment = jest.fn().mockReturnValue('web');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        const codecInfo = await service.checkSystemCodecs();

        expect(codecInfo).not.toHaveProperty('electronVersion');
        expect(codecInfo).not.toHaveProperty('chromiumVersion');
      });
    });

    describe('getAudioMetadata', () => {
      it('should return null for non-Electron environment', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('web');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        const metadata = await service.getAudioMetadata('/path/to/audio.mp3');

        expect(metadata).toBeNull();
      });

      it('should return null when electronAPI is not available', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('electron');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        getTestGlobalState().window = {};

        const metadata = await service.getAudioMetadata('/path/to/audio.mp3');

        expect(metadata).toBeNull();
      });

      it('should return metadata for Electron environment', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('electron');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        const mockMetadata = {
          duration: 240.5,
          bitrate: 256,
          sampleRate: 48000,
          channels: 2,
          format: 'FLAC',
        };

        getTestGlobalState().window = {
          electronAPI: {
            getAudioMetadata: jest.fn().mockResolvedValue(mockMetadata),
          },
        };

        const metadata = await service.getAudioMetadata('/path/to/audio.flac');

        expect(metadata).toEqual(mockMetadata);
        expect(
          getTestGlobalState().window.electronAPI!.getAudioMetadata
        ).toHaveBeenCalledWith('/path/to/audio.flac');
      });

      it('should handle errors gracefully', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('electron');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        getTestGlobalState().window = {
          electronAPI: {
            getAudioMetadata: jest
              .fn()
              .mockRejectedValue(new Error('File access denied')),
          },
        };

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const metadata = await service.getAudioMetadata(
          '/path/to/protected.mp3'
        );

        expect(metadata).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[ElectronAudioService] Failed to get audio metadata:',
          expect.any(Error)
        );

        consoleWarnSpy.mockRestore();
      });
    });

    describe('getAudioDevices', () => {
      it('should return null for non-Electron environment', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('web');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        const devices = await service.getAudioDevices();

        expect(devices).toBeNull();
      });

      it('should return null when electronAPI is not available', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('electron');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        getTestGlobalState().window = {};

        const devices = await service.getAudioDevices();

        expect(devices).toBeNull();
      });

      it('should return audio devices for Electron environment', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('electron');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        const mockDevices = {
          inputDevices: [
            { id: 'input1', name: 'Built-in Microphone' },
            { id: 'input2', name: 'External USB Mic' },
          ],
          outputDevices: [
            { id: 'output1', name: 'Built-in Speakers' },
            { id: 'output2', name: 'HDMI Audio' },
          ],
        };

        getTestGlobalState().window = {
          electronAPI: {
            getAudioDevices: jest.fn().mockResolvedValue(mockDevices),
          },
        };

        const devices = await service.getAudioDevices();

        expect(devices).toEqual(mockDevices);
        expect(
          getTestGlobalState().window.electronAPI!.getAudioDevices
        ).toHaveBeenCalled();
      });

      it('should handle errors gracefully', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('electron');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        getTestGlobalState().window = {
          electronAPI: {
            getAudioDevices: jest
              .fn()
              .mockRejectedValue(new Error('Audio subsystem error')),
          },
        };

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const devices = await service.getAudioDevices();

        expect(devices).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[ElectronAudioService] Failed to get audio devices:',
          expect.any(Error)
        );

        consoleWarnSpy.mockRestore();
      });
    });

    describe('getSystemAudioSettings', () => {
      it('should return null for non-Electron environment', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('web');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        const settings = await service.getSystemAudioSettings();

        expect(settings).toBeNull();
      });

      it('should return null when electronAPI is not available', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('electron');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        getTestGlobalState().window = {};

        const settings = await service.getSystemAudioSettings();

        expect(settings).toBeNull();
      });

      it('should return system audio settings for Electron environment', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('electron');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        const mockSettings = {
          defaultInputDevice: 'input1',
          defaultOutputDevice: 'output1',
          masterVolume: 0.75,
        };

        getTestGlobalState().window = {
          electronAPI: {
            getSystemAudioSettings: jest.fn().mockResolvedValue(mockSettings),
          },
        };

        const settings = await service.getSystemAudioSettings();

        expect(settings).toEqual(mockSettings);
        expect(
          getTestGlobalState().window.electronAPI!.getSystemAudioSettings
        ).toHaveBeenCalled();
      });

      it('should handle errors gracefully', async () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('electron');
        getAudioClient(service).getEnvironment = mockGetEnvironment;

        getTestGlobalState().window = {
          electronAPI: {
            getSystemAudioSettings: jest
              .fn()
              .mockRejectedValue(new Error('Settings unavailable')),
          },
        };

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const settings = await service.getSystemAudioSettings();

        expect(settings).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[ElectronAudioService] Failed to get system audio settings:',
          expect.any(Error)
        );

        consoleWarnSpy.mockRestore();
      });
    });
  });
});
