import {
  createMediaElementController,
  type MediaElementController,
} from 'desktop-audio-proxy/browser';

export interface RadioPlayerElements {
  audio: HTMLAudioElement;
  form: HTMLFormElement;
  urlInput: HTMLInputElement;
  status: HTMLElement;
  stopButton?: HTMLButtonElement;
}

export interface RadioStation {
  url?: string;
  sources?: ReadonlyArray<{
    url: string;
    type?: string;
    codecs?: string;
  }>;
}

/** Prepare a single station URL or a typed cross-engine fallback list. */
export function prepareRadioStation(
  controller: MediaElementController,
  station: RadioStation
): Promise<string | null> {
  if (station.sources?.length) {
    return controller.loadBest(station.sources);
  }
  if (station.url) {
    return controller.load(station.url);
  }
  throw new TypeError('A station URL or source list is required');
}

/**
 * Attach Desktop Audio Proxy to an existing browser/WebView radio player.
 *
 * Start the proxy in an Electron main process, Node host, or Tauri sidecar.
 * The browser entry intentionally cannot start a Node server.
 */
export function attachRadioPlayer(
  elements: RadioPlayerElements,
  proxyUrl = 'http://127.0.0.1:3002'
): MediaElementController {
  const controller = createMediaElementController(elements.audio, {
    proxyUrl,
    autoDetect: false,
    autoStartProxy: false,
    fallbackToOriginal: false,
    retryAttempts: 2,
  });

  elements.form.addEventListener('submit', event => {
    event.preventDefault();
    const stationUrl = elements.urlInput.value.trim();
    if (!stationUrl) {
      elements.status.textContent = 'Enter an HTTP or HTTPS station URL.';
      return;
    }

    elements.status.textContent = 'Preparing secure proxy stream…';
    void controller
      .load(stationUrl)
      .then(playableUrl => {
        elements.status.textContent = playableUrl
          ? 'Station ready; press play in the media controls.'
          : 'A newer station request replaced this one.';
      })
      .catch(error => {
        elements.status.textContent =
          error instanceof Error ? error.message : 'Unable to play station.';
      });
  });

  elements.stopButton?.addEventListener('click', () => {
    controller.stop();
    elements.status.textContent = 'Playback stopped.';
  });

  window.addEventListener(
    'beforeunload',
    () => {
      void controller.dispose();
    },
    { once: true }
  );

  return controller;
}
