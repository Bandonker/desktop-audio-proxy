import { TauriAudioService } from '../tauri-service';
import { ElectronAudioService } from '../electron-service';

// Mock the AudioProxyClient
jest.mock('../client');

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
      } as any);
      expect(legacyService).toBeDefined();
    });

    describe('getStreamableUrl', () => {
      it('should delegate to AudioProxyClient', async () => {
        const mockUrl = 'https://example.com/audio.mp3';
        const expectedUrl =
          'http://localhost:3001/stream?url=' + encodeURIComponent(mockUrl);

        // Mock the client method
        const mockGetPlayableUrl = jest.fn().mockResolvedValue(expectedUrl);
        (service as any).audioClient.getPlayableUrl = mockGetPlayableUrl;

        const result = await service.getStreamableUrl(mockUrl);

        expect(mockGetPlayableUrl).toHaveBeenCalledWith(mockUrl);
        expect(result).toBe(expectedUrl);
      });

      it('should handle errors gracefully', async () => {
        const mockUrl = 'https://example.com/audio.mp3';

        const mockGetPlayableUrl = jest
          .fn()
          .mockRejectedValue(new Error('Network error'));
        (service as any).audioClient.getPlayableUrl = mockGetPlayableUrl;

        await expect(service.getStreamableUrl(mockUrl)).rejects.toThrow(
          'Network error'
        );
      });
    });

    describe('canPlayStream', () => {
      it('should delegate to AudioProxyClient', async () => {
        const mockUrl = 'https://example.com/audio.mp3';

        const mockCanPlayUrl = jest.fn().mockResolvedValue(true);
        (service as any).audioClient.canPlayUrl = mockCanPlayUrl;

        const result = await service.canPlayStream(mockUrl);

        expect(mockCanPlayUrl).toHaveBeenCalledWith(mockUrl);
        expect(result).toBe(true);
      });
    });

    describe('Environment detection', () => {
      it('should expose environment detection', () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('tauri');
        (service as any).audioClient.getEnvironment = mockGetEnvironment;

        const env = service.getEnvironment();

        expect(mockGetEnvironment).toHaveBeenCalled();
        expect(env).toBe('tauri');
      });
    });

    describe('isProxyAvailable', () => {
      it('should check proxy availability', async () => {
        const mockIsProxyAvailable = jest.fn().mockResolvedValue(true);
        (service as any).audioClient.isProxyAvailable = mockIsProxyAvailable;

        const isAvailable = await service.isProxyAvailable();

        expect(mockIsProxyAvailable).toHaveBeenCalled();
        expect(isAvailable).toBe(true);
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
        (service as any).audioClient.getPlayableUrl = mockGetPlayableUrl;

        const result = await service.getStreamableUrl(mockUrl);

        expect(mockGetPlayableUrl).toHaveBeenCalledWith(mockUrl);
        expect(result).toBe(expectedUrl);
      });
    });

    describe('checkSystemCodecs', () => {
      it('should return supported and missing codecs', async () => {
        const codecInfo = await service.checkSystemCodecs();

        expect(codecInfo).toHaveProperty('supportedFormats');
        expect(codecInfo).toHaveProperty('missingCodecs');
        expect(Array.isArray(codecInfo.supportedFormats)).toBe(true);
        expect(Array.isArray(codecInfo.missingCodecs)).toBe(true);
      });

      it('should correctly identify supported formats', async () => {
        const codecInfo = await service.checkSystemCodecs();

        expect(codecInfo.supportedFormats).toContain('MP3');
        expect(codecInfo.supportedFormats).toContain('WAV');
        expect(codecInfo.supportedFormats).toContain('OGG');
      });

      it('should correctly identify missing codecs', async () => {
        const codecInfo = await service.checkSystemCodecs();

        expect(codecInfo.missingCodecs).toContain('AAC');
        expect(codecInfo.missingCodecs).toContain('FLAC');
        expect(codecInfo.missingCodecs).toContain('WEBM');
      });
    });

    describe('canPlayStream', () => {
      it('should delegate to AudioProxyClient', async () => {
        const mockUrl = 'https://example.com/audio.mp3';

        const mockCanPlayUrl = jest.fn().mockResolvedValue(true);
        (service as any).audioClient.canPlayUrl = mockCanPlayUrl;

        const result = await service.canPlayStream(mockUrl);

        expect(mockCanPlayUrl).toHaveBeenCalledWith(mockUrl);
        expect(result).toBe(true);
      });
    });

    describe('Environment detection', () => {
      it('should expose environment detection', () => {
        const mockGetEnvironment = jest.fn().mockReturnValue('electron');
        (service as any).audioClient.getEnvironment = mockGetEnvironment;

        const env = service.getEnvironment();

        expect(mockGetEnvironment).toHaveBeenCalled();
        expect(env).toBe('electron');
      });
    });

    describe('isProxyAvailable', () => {
      it('should check proxy availability', async () => {
        const mockIsProxyAvailable = jest.fn().mockResolvedValue(true);
        (service as any).audioClient.isProxyAvailable = mockIsProxyAvailable;

        const isAvailable = await service.isProxyAvailable();

        expect(mockIsProxyAvailable).toHaveBeenCalled();
        expect(isAvailable).toBe(true);
      });
    });
  });
});
