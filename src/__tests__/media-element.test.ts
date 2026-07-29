import * as publicApi from '../index';
import { AudioProxyOptions } from '../types';

interface MediaElementController {
  load(url: string): Promise<string | null>;
  loadBest(
    candidates: ReadonlyArray<{
      url: string;
      type?: string;
      codecs?: string;
    }>
  ): Promise<string | null>;
  play(url: string): Promise<string | null>;
  stop(): void;
  dispose(): Promise<void>;
}

type CreateMediaElementController = (
  element: HTMLMediaElement,
  options?: AudioProxyOptions
) => MediaElementController;

const createMediaElementController = (
  publicApi as unknown as {
    createMediaElementController: CreateMediaElementController;
  }
).createMediaElementController;

function createTestMediaElement(): HTMLMediaElement {
  return {
    tagName: 'AUDIO',
    src: '',
    crossOrigin: null,
    preload: '',
    canPlayType: jest.fn((type: string) =>
      type === 'audio/mpeg' ? 'probably' : ''
    ),
    getAttribute: jest.fn().mockReturnValue(null),
    setAttribute: jest.fn(),
    load: jest.fn(),
    pause: jest.fn(),
    play: jest.fn().mockResolvedValue(undefined),
    removeAttribute: jest.fn(),
  } as unknown as HTMLMediaElement;
}

describe('media element controller', () => {
  it('rejects a missing media element during setup', () => {
    expect(() =>
      createMediaElementController(null as unknown as HTMLMediaElement)
    ).toThrow('HTMLMediaElement');
  });

  it('loads a remote station through the configured proxy', async () => {
    const media = createTestMediaElement();
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 'ok' }),
    } as Response);

    const controller = createMediaElementController(media, {
      proxyUrl: 'http://localhost:3001',
      autoDetect: false,
      fallbackToOriginal: false,
    });
    const stationUrl = 'https://radio.example/live.mp3';
    const expectedUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(
      stationUrl
    )}`;

    await expect(controller.load(stationUrl)).resolves.toBe(expectedUrl);
    expect(media.src).toBe(expectedUrl);
    expect(media.load).toHaveBeenCalledTimes(1);
  });

  it('selects the best supported source before loading it through the proxy', async () => {
    const media = createTestMediaElement();
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 'ok' }),
    } as Response);
    const controller = createMediaElementController(media, {
      proxyUrl: 'http://localhost:3001',
      autoDetect: false,
      fallbackToOriginal: false,
    });

    const playableUrl = await controller.loadBest([
      { url: 'https://radio.example/live.ogg', type: 'audio/ogg' },
      { url: 'https://radio.example/live.mp3', type: 'audio/mpeg' },
    ]);

    expect(playableUrl).toContain(
      encodeURIComponent('https://radio.example/live.mp3')
    );
    expect(media.src).toBe(playableUrl);
  });

  it('fails closed instead of silently loading a CORS-prone direct URL', async () => {
    const media = createTestMediaElement();
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockRejectedValueOnce(new Error('proxy offline'));
    const controller = createMediaElementController(media, {
      proxyUrl: 'http://localhost:3001',
      autoDetect: false,
      retryAttempts: 1,
      retryDelay: 0,
    });

    await expect(
      controller.load('https://radio.example/live.mp3')
    ).rejects.toThrow('Proxy server unavailable');
    expect(media.src).toBe('');
    expect(media.load).not.toHaveBeenCalled();
  });

  it('starts playback after preparing a station URL', async () => {
    const media = createTestMediaElement();
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 'ok' }),
    } as Response);
    const controller = createMediaElementController(media, {
      proxyUrl: 'http://localhost:3001',
      autoDetect: false,
      fallbackToOriginal: false,
    });

    const playableUrl = await controller.play('https://radio.example/live.aac');

    expect(playableUrl).toContain('http://localhost:3001/proxy?url=');
    expect(media.play).toHaveBeenCalledTimes(1);
  });

  it('returns null when stopped while element playback is pending', async () => {
    const media = createTestMediaElement();
    let signalPlayStarted: (() => void) | undefined;
    let resolvePlay: (() => void) | undefined;
    const playStarted = new Promise<void>(resolve => {
      signalPlayStarted = resolve;
    });
    (media.play as jest.Mock).mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolvePlay = resolve;
          signalPlayStarted?.();
        })
    );
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 'ok' }),
    } as Response);
    const controller = createMediaElementController(media, {
      proxyUrl: 'http://localhost:3001',
      autoDetect: false,
      fallbackToOriginal: false,
    });

    const pendingPlay = controller.play('https://radio.example/live.aac');
    await playStarted;
    controller.stop();
    resolvePlay?.();

    await expect(pendingPlay).resolves.toBeNull();
  });

  it('suppresses a playback abort after disposal cancels the operation', async () => {
    const media = createTestMediaElement();
    let signalPlayStarted: (() => void) | undefined;
    let rejectPlay: ((error: Error) => void) | undefined;
    const playStarted = new Promise<void>(resolve => {
      signalPlayStarted = resolve;
    });
    (media.play as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectPlay = reject;
          signalPlayStarted?.();
        })
    );
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 'ok' }),
    } as Response);
    const controller = createMediaElementController(media, {
      proxyUrl: 'http://localhost:3001',
      autoDetect: false,
      fallbackToOriginal: false,
    });

    const pendingPlay = controller.play('https://radio.example/live.aac');
    await playStarted;
    await controller.dispose();
    const abortError = new Error('The play request was interrupted');
    abortError.name = 'AbortError';
    rejectPlay?.(abortError);

    await expect(pendingPlay).resolves.toBeNull();
  });

  it('stops playback and clears the media source', () => {
    const media = createTestMediaElement();
    const controller = createMediaElementController(media, {
      autoDetect: false,
    });

    controller.stop();

    expect(media.pause).toHaveBeenCalledTimes(1);
    expect(media.removeAttribute).toHaveBeenCalledWith('src');
    expect(media.load).toHaveBeenCalledTimes(1);
  });

  it('does not let a slower station request replace the latest station', async () => {
    const media = createTestMediaElement();
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    let resolveFirstHealthCheck: ((response: Response) => void) | undefined;
    mockFetch
      .mockImplementationOnce(
        () =>
          new Promise<Response>(resolve => {
            resolveFirstHealthCheck = resolve;
          })
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'ok' }),
      } as Response);
    const controller = createMediaElementController(media, {
      proxyUrl: 'http://localhost:3001',
      autoDetect: false,
      fallbackToOriginal: false,
    });

    const firstLoad = controller.load('https://radio.example/slow.mp3');
    const secondLoad = controller.load('https://radio.example/live.mp3');
    const secondUrl = await secondLoad;
    resolveFirstHealthCheck?.({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 'ok' }),
    } as Response);

    await expect(firstLoad).resolves.toBeNull();
    expect(media.src).toBe(secondUrl);
    expect(media.load).toHaveBeenCalledTimes(1);
  });

  it('suppresses a proxy failure after the pending load is stopped', async () => {
    const media = createTestMediaElement();
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    let signalHealthCheckStarted: (() => void) | undefined;
    let rejectHealthCheck: ((error: Error) => void) | undefined;
    const healthCheckStarted = new Promise<void>(resolve => {
      signalHealthCheckStarted = resolve;
    });
    mockFetch.mockImplementationOnce(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectHealthCheck = reject;
          signalHealthCheckStarted?.();
        })
    );
    const controller = createMediaElementController(media, {
      proxyUrl: 'http://localhost:3001',
      autoDetect: false,
      fallbackToOriginal: false,
      retryAttempts: 1,
      retryDelay: 0,
    });

    const pendingLoad = controller.load('https://radio.example/live.mp3');
    await healthCheckStarted;
    controller.stop();
    rejectHealthCheck?.(new Error('proxy offline'));

    await expect(pendingLoad).resolves.toBeNull();
    expect(media.src).toBe('');
    expect(media.play).not.toHaveBeenCalled();
  });

  it('disposes playback without allowing pending work to restore the source', async () => {
    const media = createTestMediaElement();
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    let resolveHealthCheck: ((response: Response) => void) | undefined;
    mockFetch.mockImplementationOnce(
      () =>
        new Promise<Response>(resolve => {
          resolveHealthCheck = resolve;
        })
    );
    const controller = createMediaElementController(media, {
      proxyUrl: 'http://localhost:3001',
      autoDetect: false,
      fallbackToOriginal: false,
    });

    const pendingLoad = controller.load('https://radio.example/live.mp3');
    await controller.dispose();
    resolveHealthCheck?.({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 'ok' }),
    } as Response);

    await expect(pendingLoad).resolves.toBeNull();
    expect(media.pause).toHaveBeenCalledTimes(1);
    expect(media.removeAttribute).toHaveBeenCalledWith('src');
  });

  it('rejects new station loads after disposal', async () => {
    const media = createTestMediaElement();
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 'ok' }),
    } as Response);
    const controller = createMediaElementController(media, {
      proxyUrl: 'http://localhost:3001',
      autoDetect: false,
    });

    await controller.dispose();

    await expect(
      controller.load('https://radio.example/live.mp3')
    ).rejects.toThrow('disposed');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
