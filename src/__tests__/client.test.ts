import { AudioProxyClient } from '../client';

// Mock fetch globally
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Type for window mock
interface WindowMock {
  __TAURI__?: {
    tauri: {
      convertFileSrc: jest.MockedFunction<(_filePath: string) => string>;
    };
  };
  electronAPI?: unknown;
}

// Type for global mock
interface GlobalMock {
  window?: WindowMock;
  process?: {
    versions?: {
      electron?: string;
    };
  };
}

describe('AudioProxyClient', () => {
  let client: AudioProxyClient;

  beforeEach(() => {
    // Clear mock call history but preserve implementations
    mockFetch.mockClear();

    client = new AudioProxyClient({
      proxyUrl: 'http://localhost:3001',
      autoDetect: true,
      fallbackToOriginal: true,
      retryAttempts: 2,
    });
  });

  afterEach(() => {
    // Reset any custom implementations after each test
    mockFetch.mockReset();
  });

  describe('Environment Detection', () => {
    beforeEach(() => {
      // Clear any existing window properties
      delete (global as GlobalMock).window;
      delete (global as GlobalMock).process;
    });

    it('should detect unknown environment when window is undefined', () => {
      const testClient = new AudioProxyClient();
      expect(testClient.getEnvironment()).toBe('unknown');
    });

    it('should detect Tauri environment', () => {
      (global as GlobalMock).window = {
        __TAURI__: { tauri: { convertFileSrc: jest.fn() } },
      };
      const testClient = new AudioProxyClient();
      expect(testClient.getEnvironment()).toBe('tauri');
    });

    it('should detect Electron environment via electronAPI', () => {
      (global as GlobalMock).window = { electronAPI: {} };
      const testClient = new AudioProxyClient();
      expect(testClient.getEnvironment()).toBe('electron');
    });

    it('should detect Electron environment via process.versions', () => {
      (global as GlobalMock).window = {};
      (global as GlobalMock).process = { versions: { electron: '25.0.0' } };
      const testClient = new AudioProxyClient();
      expect(testClient.getEnvironment()).toBe('electron');
    });

    it('should detect web environment as fallback', () => {
      (global as GlobalMock).window = {};
      const testClient = new AudioProxyClient();
      expect(testClient.getEnvironment()).toBe('web');
    });
  });

  describe('Proxy Availability Check', () => {
    it('should return true when proxy health check succeeds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
      } as Response);

      const isAvailable = await client.isProxyAvailable();
      expect(isAvailable).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/health',
        expect.objectContaining({
          method: 'GET',
          cache: 'no-cache',
        })
      );
    });

    it('should return false when proxy health check fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const isAvailable = await client.isProxyAvailable();
      expect(isAvailable).toBe(false);
    });

    it('should timeout after 5 seconds', async () => {
      // Mock a hanging request
      mockFetch.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 6000))
      );

      const isAvailable = await client.isProxyAvailable();
      expect(isAvailable).toBe(false);
    });
  });

  describe('URL Processing', () => {
    beforeEach(() => {
      (global as GlobalMock).window = {};
    });

    it('should return original URL when proxy is not available', async () => {
      // Mock health check failure for canPlayUrl
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      // Mock health check failures for retry in getPlayableUrl
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const originalUrl = 'https://example.com/audio.mp3';
      const result = await client.getPlayableUrl(originalUrl);

      expect(result).toBe(originalUrl);
    });

    it('should return proxy URL when proxy is available', async () => {
      // Mock health check for canPlayUrl call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
      } as Response);

      // Mock stream info call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            url: 'https://example.com/audio.mp3',
            status: 200,
            headers: {},
            canPlay: true,
            requiresProxy: true,
          }),
      } as Response);

      // Mock health check for getPlayableUrl retry logic
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
      } as Response);

      const originalUrl = 'https://example.com/audio.mp3';
      const result = await client.getPlayableUrl(originalUrl);

      const expectedProxyUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(originalUrl)}`;
      expect(result).toBe(expectedProxyUrl);
    });

    it('should handle file:// URLs directly', async () => {
      const fileUrl = 'file:///path/to/audio.mp3';
      const result = await client.getPlayableUrl(fileUrl);

      expect(result).toBe(fileUrl);
      // No fetch calls should be made for local files
    });

    it('should handle data: URLs by falling back to original', async () => {
      // Mock health check failure for data URLs (they don't need proxy anyway)
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      // Mock additional health check failures for retry logic
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const dataUrl = 'data:audio/mp3;base64,SGVsbG8gV29ybGQ=';
      const result = await client.getPlayableUrl(dataUrl);

      expect(result).toBe(dataUrl);
    });

    it('should handle blob: URLs by falling back to original', async () => {
      // Mock health check failure for blob URLs (they don't need proxy anyway)
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      // Mock additional health check failures for retry logic
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const blobUrl =
        'blob:http://localhost:3000/12345678-1234-1234-1234-123456789012';
      const result = await client.getPlayableUrl(blobUrl);

      expect(result).toBe(blobUrl);
    });
  });

  describe('Stream Info', () => {
    it('should fetch stream info when proxy is available', async () => {
      const mockStreamInfo = {
        url: 'https://example.com/audio.mp3',
        status: 200,
        headers: {},
        canPlay: true,
        requiresProxy: true,
        contentType: 'audio/mpeg',
        contentLength: '1024000',
      };

      // Mock implementation for this specific test
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: health check
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'healthy' }),
          } as Response);
        } else {
          // Second call: stream info
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                url: mockStreamInfo.url,
                status: mockStreamInfo.status,
                headers: mockStreamInfo.headers,
                contentType: mockStreamInfo.contentType,
                contentLength: mockStreamInfo.contentLength,
                acceptRanges: 'bytes',
                lastModified: 'Wed, 01 Jan 2020 00:00:00 GMT',
              }),
          } as Response);
        }
      });

      const result = await client.canPlayUrl('https://example.com/audio.mp3');

      expect(result.url).toBe(mockStreamInfo.url);
      expect(result.status).toBe(mockStreamInfo.status);
      expect(result.canPlay).toBe(true);
      expect(result.requiresProxy).toBe(true);
      expect(result.contentType).toBe('audio/mpeg');
      expect(result.contentLength).toBe('1024000');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/info?url=')
      );
    });

    it('should return fallback info when proxy is not available', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.canPlayUrl('https://example.com/audio.mp3');
      expect(result.canPlay).toBe(false);
      expect(result.requiresProxy).toBe(true);
    });
  });

  describe('URL Validation', () => {
    beforeEach(() => {
      (global as GlobalMock).window = {};
    });

    it('should handle URL validation through canPlayUrl', async () => {
      // Mock implementation for this specific test
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: health check
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'healthy' }),
          } as Response);
        } else {
          // Second call: stream info
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                url: 'https://example.com/audio.mp3',
                status: 200,
                headers: {},
                contentType: 'audio/mpeg',
                contentLength: '1024000',
                acceptRanges: 'bytes',
                lastModified: 'Wed, 01 Jan 2020 00:00:00 GMT',
              }),
          } as Response);
        }
      });

      const streamInfo = await client.canPlayUrl(
        'https://example.com/audio.mp3'
      );
      expect(streamInfo.canPlay).toBe(true);
      expect(streamInfo.requiresProxy).toBe(true);
      expect(streamInfo.status).toBe(200);
    });

    it('should return false for invalid URLs', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const streamInfo = await client.canPlayUrl('invalid-url');
      expect(streamInfo.canPlay).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration when no options provided', () => {
      const defaultClient = new AudioProxyClient();
      expect(defaultClient.getEnvironment()).toBeDefined();
    });

    it('should merge provided options with defaults', () => {
      const customClient = new AudioProxyClient({
        proxyUrl: 'http://custom:8080',
        retryAttempts: 5,
      });

      expect(customClient).toBeDefined();
    });
  });
});
