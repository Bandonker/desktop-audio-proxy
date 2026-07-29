import * as publicApi from '../index';

interface MediaSourceCandidate {
  url: string;
  type?: string;
  codecs?: string;
}

type DetectMediaEngine = (
  userAgent?: string
) => 'webkit' | 'chromium' | 'gecko' | 'unknown';
type SelectPlayableMediaSource = (
  element: HTMLMediaElement,
  candidates: readonly MediaSourceCandidate[]
) => MediaSourceCandidate;
type ConfigureMediaElementForCompatibility = (element: HTMLMediaElement) => {
  engine: 'webkit' | 'chromium' | 'gecko' | 'unknown';
  nativeHls: boolean;
};

const compatibilityApi = publicApi as unknown as {
  detectMediaEngine: DetectMediaEngine;
  selectPlayableMediaSource: SelectPlayableMediaSource;
  configureMediaElementForCompatibility: ConfigureMediaElementForCompatibility;
};

function createMediaElement(
  support: Record<string, CanPlayTypeResult> = {}
): HTMLMediaElement {
  const attributes = new Map<string, string>();
  return {
    tagName: 'VIDEO',
    crossOrigin: null,
    preload: '',
    canPlayType: jest.fn((type: string) => support[type] || ''),
    getAttribute: jest.fn((name: string) => attributes.get(name) ?? null),
    setAttribute: jest.fn((name: string, value: string) => {
      attributes.set(name, value);
    }),
  } as unknown as HTMLMediaElement;
}

describe('media compatibility helpers', () => {
  it('detects Apple WebKit without misclassifying Chromium or Electron', () => {
    expect(
      compatibilityApi.detectMediaEngine(
        'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'
      )
    ).toBe('webkit');
    expect(
      compatibilityApi.detectMediaEngine(
        'Mozilla/5.0 AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36'
      )
    ).toBe('chromium');
    expect(
      compatibilityApi.detectMediaEngine(
        'Mozilla/5.0 AppleWebKit/537.36 Electron/31.0.0 Chrome/126.0.0.0 Safari/537.36'
      )
    ).toBe('chromium');
    expect(
      compatibilityApi.detectMediaEngine(
        'Mozilla/5.0 Gecko/20100101 Firefox/128.0'
      )
    ).toBe('gecko');
  });

  it('identifies branded iOS browsers as WebKit engines', () => {
    expect(
      compatibilityApi.detectMediaEngine(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/126.0.0.0 Mobile/15E148 Safari/604.1'
      )
    ).toBe('webkit');
    expect(
      compatibilityApi.detectMediaEngine(
        'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 EdgiOS/126.0 Mobile/15E148 Safari/605.1.15'
      )
    ).toBe('webkit');
  });

  it('prefers a probably playable source over a maybe playable source', () => {
    const media = createMediaElement({
      'audio/ogg; codecs="vorbis"': 'maybe',
      'audio/mpeg': 'probably',
    });
    const candidates = [
      {
        url: 'https://radio.example/live.ogg',
        type: 'audio/ogg',
        codecs: 'vorbis',
      },
      { url: 'https://radio.example/live.mp3', type: 'audio/mpeg' },
    ];

    expect(
      compatibilityApi.selectPlayableMediaSource(media, candidates)
    ).toEqual(candidates[1]);
  });

  it('uses an untyped source only when no typed candidate is supported', () => {
    const media = createMediaElement();
    const candidates = [
      { url: 'https://radio.example/live.flac', type: 'audio/flac' },
      { url: 'https://radio.example/live' },
    ];

    expect(
      compatibilityApi.selectPlayableMediaSource(media, candidates)
    ).toEqual(candidates[1]);
  });

  it('rejects an empty or wholly unsupported source list', () => {
    const media = createMediaElement();

    expect(() => compatibilityApi.selectPlayableMediaSource(media, [])).toThrow(
      'At least one media source'
    );
    expect(() =>
      compatibilityApi.selectPlayableMediaSource(media, [
        { url: 'https://radio.example/live.flac', type: 'audio/flac' },
      ])
    ).toThrow('supported media source');
  });

  it('applies cross-origin, metadata preload, inline video, and native HLS defaults', () => {
    const media = createMediaElement({
      'application/vnd.apple.mpegurl': 'maybe',
    }) as HTMLVideoElement;

    const profile =
      compatibilityApi.configureMediaElementForCompatibility(media);

    expect(media.crossOrigin).toBe('anonymous');
    expect(media.preload).toBe('metadata');
    expect(media.setAttribute).toHaveBeenCalledWith('playsinline', '');
    expect(profile.nativeHls).toBe(true);
  });

  it('preserves explicit cross-origin and preload choices', () => {
    const media = createMediaElement();
    media.crossOrigin = 'use-credentials';
    media.preload = 'none';

    compatibilityApi.configureMediaElementForCompatibility(media);

    expect(media.crossOrigin).toBe('use-credentials');
    expect(media.preload).toBe('none');
  });
});
