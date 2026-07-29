import { createMediaElementController } from 'desktop-audio-proxy/browser';

/**
 * Connect an existing Tauri audio element to a host-managed proxy sidecar.
 *
 * Obtain proxyUrl from a narrow Tauri command after the sidecar starts. Do not
 * let arbitrary renderer input control sidecar commands or process arguments.
 */
export function attachTauriRadioPlayer(audioElement, proxyUrl) {
  if (!(audioElement instanceof HTMLAudioElement)) {
    throw new TypeError('attachTauriRadioPlayer requires an audio element');
  }
  if (!proxyUrl) {
    throw new Error('The Tauri host did not provide a proxy URL');
  }

  const controller = createMediaElementController(audioElement, {
    proxyUrl,
    autoDetect: false,
    autoStartProxy: false,
    fallbackToOriginal: false,
    retryAttempts: 2,
  });

  return {
    prepareStation: station =>
      Array.isArray(station.sources)
        ? controller.loadBest(station.sources)
        : controller.load(station.url),
    stop: () => controller.stop(),
    dispose: () => controller.dispose(),
  };
}
