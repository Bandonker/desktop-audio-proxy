
export { AudioProxyClient } from './client';
export { TauriAudioService } from './tauri-service';
export { ElectronAudioService } from './electron-service';
export * from './types';

// Server-specific exports
export { AudioProxyServer, createProxyServer, startProxyServer } from './server-impl';
export { createAudioClient } from './client';