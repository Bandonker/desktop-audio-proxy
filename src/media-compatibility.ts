export type MediaEngine = 'webkit' | 'chromium' | 'gecko' | 'unknown';

export interface MediaSourceCandidate {
  /** Absolute station or media URL. */
  url: string;
  /** MIME type used with HTMLMediaElement.canPlayType(). */
  type?: string;
  /** Optional codec list, for example "mp4a.40.2". */
  codecs?: string;
}

export interface MediaCompatibilityProfile {
  engine: MediaEngine;
  /** True when the current media engine reports native HLS support. */
  nativeHls: boolean;
}

const CHROMIUM_MARKERS =
  /\b(?:Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|Electron)\//i;

function getRuntimeUserAgent(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

export function detectMediaEngine(
  userAgent: string = getRuntimeUserAgent()
): MediaEngine {
  const isAppleMobileWebKit =
    /AppleWebKit\//i.test(userAgent) &&
    !/Android/i.test(userAgent) &&
    (/\b(?:iPhone|iPad|iPod)\b/i.test(userAgent) ||
      /Macintosh;.*\bMobile\//i.test(userAgent));
  if (isAppleMobileWebKit) {
    return 'webkit';
  }
  if (CHROMIUM_MARKERS.test(userAgent)) {
    return 'chromium';
  }
  if (/AppleWebKit\//i.test(userAgent)) {
    return 'webkit';
  }
  if (/\b(?:Firefox|FxiOS)\//i.test(userAgent)) {
    return 'gecko';
  }
  return 'unknown';
}

function getCandidateType(candidate: MediaSourceCandidate): string | null {
  const type = candidate.type?.trim();
  if (!type) {
    return null;
  }
  const codecs = candidate.codecs?.trim();
  return codecs ? `${type}; codecs="${codecs}"` : type;
}

function getSupportRank(support: CanPlayTypeResult): number {
  if (support === 'probably') {
    return 2;
  }
  if (support === 'maybe') {
    return 1;
  }
  return 0;
}

export function selectPlayableMediaSource(
  element: HTMLMediaElement,
  candidates: readonly MediaSourceCandidate[]
): MediaSourceCandidate {
  if (!element || typeof element.canPlayType !== 'function') {
    throw new TypeError('A valid HTMLMediaElement is required');
  }
  if (candidates.length === 0) {
    throw new TypeError('At least one media source candidate is required');
  }

  let bestCandidate: MediaSourceCandidate | null = null;
  let bestRank = 0;
  let untypedFallback: MediaSourceCandidate | null = null;

  for (const candidate of candidates) {
    if (!candidate.url?.trim()) {
      continue;
    }
    const candidateType = getCandidateType(candidate);
    if (!candidateType) {
      untypedFallback ??= candidate;
      continue;
    }

    let rank = 0;
    try {
      rank = getSupportRank(element.canPlayType(candidateType));
    } catch {
      rank = 0;
    }
    if (rank > bestRank) {
      bestRank = rank;
      bestCandidate = candidate;
    }
  }

  if (bestCandidate) {
    return bestCandidate;
  }
  if (untypedFallback) {
    return untypedFallback;
  }
  throw new Error('No supported media source candidate was found');
}

export function configureMediaElementForCompatibility(
  element: HTMLMediaElement
): MediaCompatibilityProfile {
  if (!element || typeof element.canPlayType !== 'function') {
    throw new TypeError('A valid HTMLMediaElement is required');
  }

  if (!element.crossOrigin) {
    element.crossOrigin = 'anonymous';
  }
  if (!element.preload) {
    element.preload = 'metadata';
  }
  if (element.tagName?.toLowerCase() === 'video') {
    element.setAttribute('playsinline', '');
  }

  let nativeHls = false;
  try {
    nativeHls = Boolean(
      element.canPlayType('application/vnd.apple.mpegurl') ||
        element.canPlayType('application/x-mpegURL')
    );
  } catch {
    nativeHls = false;
  }

  return {
    engine: detectMediaEngine(),
    nativeHls,
  };
}
