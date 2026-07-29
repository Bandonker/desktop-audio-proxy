import { createAudioClient } from './client';
import {
  configureMediaElementForCompatibility,
  MediaSourceCandidate,
  selectPlayableMediaSource,
} from './media-compatibility';
import { AudioProxyOptions } from './types';

export interface MediaElementController {
  /** Resolve and assign a station URL. Returns null when superseded. */
  load(url: string): Promise<string | null>;
  /** Select the best source for this media engine, then resolve and assign it. */
  loadBest(candidates: readonly MediaSourceCandidate[]): Promise<string | null>;
  /** Resolve, assign, and begin playback. Returns null when superseded. */
  play(url: string): Promise<string | null>;
  /** Select the best source, resolve it, and begin playback. */
  playBest(candidates: readonly MediaSourceCandidate[]): Promise<string | null>;
  /** Cancel pending work, pause playback, and clear the media source. */
  stop(): void;
  /** Stop playback and release any proxy server owned by this controller. */
  dispose(): Promise<void>;
}

export function createMediaElementController(
  element: HTMLMediaElement,
  options: AudioProxyOptions = {}
): MediaElementController {
  if (!element) {
    throw new TypeError('A valid HTMLMediaElement is required');
  }

  configureMediaElementForCompatibility(element);
  const client = createAudioClient({
    fallbackToOriginal: false,
    ...options,
  });
  let requestGeneration = 0;
  let disposed = false;
  const prepare = async (
    url: string
  ): Promise<{ playableUrl: string; generation: number } | null> => {
    if (disposed) {
      throw new Error('Media element controller has been disposed');
    }
    const generation = ++requestGeneration;
    const playableUrl = await client.getPlayableUrl(url);
    if (generation !== requestGeneration) {
      return null;
    }
    element.src = playableUrl;
    element.load();
    return { playableUrl, generation };
  };
  const load = async (url: string): Promise<string | null> => {
    const prepared = await prepare(url);
    return prepared?.playableUrl ?? null;
  };
  const play = async (url: string): Promise<string | null> => {
    const prepared = await prepare(url);
    if (!prepared) {
      return null;
    }
    try {
      await element.play();
    } catch (error) {
      if (prepared.generation !== requestGeneration) {
        return null;
      }
      throw error;
    }
    return prepared.generation === requestGeneration
      ? prepared.playableUrl
      : null;
  };
  const stop = (): void => {
    requestGeneration += 1;
    element.pause();
    element.removeAttribute('src');
    element.load();
  };

  return {
    load,
    loadBest(
      candidates: readonly MediaSourceCandidate[]
    ): Promise<string | null> {
      return load(selectPlayableMediaSource(element, candidates).url);
    },
    play,
    async playBest(
      candidates: readonly MediaSourceCandidate[]
    ): Promise<string | null> {
      return play(selectPlayableMediaSource(element, candidates).url);
    },
    stop,
    async dispose(): Promise<void> {
      if (disposed) {
        return;
      }
      disposed = true;
      stop();
      await client.stopProxyServer();
    },
  };
}
