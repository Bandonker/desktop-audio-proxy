import {
  createMediaElementController,
  type MediaElementController,
} from 'desktop-audio-proxy/browser';

declare global {
  interface Window {
    desktopAudioProxy: {
      getProxyUrl(): Promise<string>;
    };
  }
}

let controller: MediaElementController | undefined;

export async function initializeRadioPlayer() {
  const audio = document.querySelector<HTMLAudioElement>('#radio-player');
  const form = document.querySelector<HTMLFormElement>('#station-form');
  const input = document.querySelector<HTMLInputElement>('#station-url');
  const status = document.querySelector<HTMLElement>('#station-status');
  if (!audio || !form || !input || !status) {
    throw new Error('Radio player markup is incomplete');
  }

  const proxyUrl = await window.desktopAudioProxy.getProxyUrl();
  controller = createMediaElementController(audio, {
    proxyUrl,
    autoDetect: false,
    autoStartProxy: false,
    fallbackToOriginal: false,
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    status.textContent = 'Preparing station…';
    void controller
      ?.load(input.value)
      .then(() => {
        status.textContent = 'Station ready; press play in the media controls.';
      })
      .catch(error => {
        status.textContent =
          error instanceof Error ? error.message : 'Playback failed.';
      });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  void initializeRadioPlayer();
});

window.addEventListener(
  'beforeunload',
  () => {
    void controller?.dispose();
  },
  { once: true }
);
