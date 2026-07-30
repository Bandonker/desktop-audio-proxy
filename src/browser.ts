export { AudioProxyClient } from './client';
export { TauriAudioService } from './tauri-service';
export { ElectronAudioService } from './electron-service';
export * from './types';
export { createAudioClient } from './client';
export {
  createMediaElementController,
  type MediaElementController,
} from './media-element';
export {
  configureMediaElementForCompatibility,
  detectMediaEngine,
  selectPlayableMediaSource,
  type MediaCompatibilityProfile,
  type MediaEngine,
  type MediaSourceCandidate,
} from './media-compatibility';
