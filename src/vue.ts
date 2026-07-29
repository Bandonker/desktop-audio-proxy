import {
  ref,
  isRef,
  watch,
  onMounted,
  onScopeDispose,
  getCurrentScope,
  inject,
  readonly,
  type Ref,
  type App,
} from 'vue';
import { AudioProxyClient } from './client';
import { TauriAudioService } from './tauri-service';
import { ElectronAudioService } from './electron-service';
import { AudioProxyOptions, StreamInfo, Environment } from './types';

type DesktopAudioService = TauriAudioService | ElectronAudioService;

/**
 * Injection key used by both the plugin installer and useGlobalAudioProxy.
 */
export const audioProxyInjectionKey = Symbol('audioProxy');

const WEB_AUDIO_MIME_TYPES: Record<string, string> = {
  MP3: 'audio/mpeg',
  OGG: 'audio/ogg',
  WAV: 'audio/wav',
  AAC: 'audio/aac',
  FLAC: 'audio/flac',
  WEBM: 'audio/webm',
  M4A: 'audio/mp4',
};

const WEB_AUDIO_FORMATS = Object.keys(WEB_AUDIO_MIME_TYPES);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function registerScopeCleanup(cleanup: () => void): void {
  if (getCurrentScope()) {
    onScopeDispose(cleanup);
  }
}

function createDesktopAudioService(
  environment: Environment
): DesktopAudioService | null {
  if (environment === 'tauri') {
    return new TauriAudioService();
  }
  if (environment === 'electron') {
    return new ElectronAudioService();
  }
  return null;
}

/**
 * Vue composable for managing audio proxy client with automatic URL processing
 */
export function useAudioProxy(
  url: Ref<string | null> | string | null,
  options?: AudioProxyOptions
) {
  const audioUrl = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const streamInfo = ref<StreamInfo | null>(null);

  // Create reactive URL ref if needed
  const urlRef = isRef(url) ? (url as Ref<string | null>) : ref(url);
  const client = new AudioProxyClient(options);
  let requestGeneration = 0;

  const processUrl = async (inputUrl: string) => {
    const requestId = ++requestGeneration;
    isLoading.value = true;
    error.value = null;
    audioUrl.value = null;
    streamInfo.value = null;

    try {
      // Get stream info first
      const info = await client.canPlayUrl(inputUrl);
      if (requestId !== requestGeneration) return;
      streamInfo.value = info;

      // Get playable URL
      const playableUrl = await client.getPlayableUrl(inputUrl);
      if (requestId !== requestGeneration) return;
      audioUrl.value = playableUrl;
    } catch (err) {
      if (requestId !== requestGeneration) return;
      error.value = getErrorMessage(err);
    } finally {
      if (requestId === requestGeneration) {
        isLoading.value = false;
      }
    }
  };

  const retry = () => {
    if (urlRef.value) {
      processUrl(urlRef.value);
    }
  };

  // Watch for URL changes
  watch(
    urlRef,
    (newUrl: string | null) => {
      if (newUrl) {
        processUrl(newUrl);
      } else {
        requestGeneration += 1;
        audioUrl.value = null;
        streamInfo.value = null;
        error.value = null;
        isLoading.value = false;
      }
    },
    { immediate: true }
  );

  registerScopeCleanup(() => {
    requestGeneration += 1;
    void client.stopProxyServer();
  });

  return {
    audioUrl: readonly(audioUrl),
    isLoading: readonly(isLoading),
    error: readonly(error),
    streamInfo: readonly(streamInfo),
    retry,
    client,
  };
}

/**
 * Vue composable for accessing audio capabilities and system information
 */
export function useAudioCapabilities() {
  const capabilities = ref<{
    supportedFormats: string[];
    missingCodecs: string[];
    capabilities: Record<string, string>;
    environment: Environment;
    electronVersion?: string;
    chromiumVersion?: string;
  } | null>(null);

  const devices = ref<{
    inputDevices: Array<{ id: string; name: string }>;
    outputDevices: Array<{ id: string; name: string }>;
  } | null>(null);

  const systemSettings = ref<{
    defaultInputDevice?: string;
    defaultOutputDevice?: string;
    masterVolume?: number;
  } | null>(null);

  const isLoading = ref(true);
  const error = ref<string | null>(null);

  const client = new AudioProxyClient();
  let requestGeneration = 0;

  const refresh = async () => {
    const requestId = ++requestGeneration;
    isLoading.value = true;
    error.value = null;
    devices.value = null;
    systemSettings.value = null;

    try {
      const environment = client.getEnvironment();
      const service = createDesktopAudioService(environment);

      if (service) {
        // Get codec capabilities
        const codecInfo = await service.checkSystemCodecs();
        if (requestId !== requestGeneration) return;
        capabilities.value = {
          ...codecInfo,
          environment,
        };

        // Get audio devices
        const deviceInfo = await service.getAudioDevices();
        if (requestId !== requestGeneration) return;
        if (deviceInfo) {
          devices.value = deviceInfo;
        }

        // Get system settings (Electron only)
        if (environment === 'electron' && 'getSystemAudioSettings' in service) {
          const settings = await (
            service as ElectronAudioService
          ).getSystemAudioSettings();
          if (requestId !== requestGeneration) return;
          if (settings) {
            systemSettings.value = settings;
          }
        }
      } else {
        // Basic web environment capabilities
        const audio = typeof Audio === 'undefined' ? null : new Audio();
        const supportedFormats = WEB_AUDIO_FORMATS.filter(
          format =>
            (audio?.canPlayType(WEB_AUDIO_MIME_TYPES[format]) ?? '') !== ''
        );

        if (requestId !== requestGeneration) return;
        capabilities.value = {
          supportedFormats,
          missingCodecs: WEB_AUDIO_FORMATS.filter(
            format => !supportedFormats.includes(format)
          ),
          capabilities: {},
          environment,
        };
      }
    } catch (err) {
      if (requestId === requestGeneration) {
        error.value = getErrorMessage(err);
      }
    } finally {
      if (requestId === requestGeneration) {
        isLoading.value = false;
      }
    }
  };

  onMounted(() => {
    refresh();
  });
  registerScopeCleanup(() => {
    requestGeneration += 1;
  });

  return {
    capabilities: readonly(capabilities),
    devices: readonly(devices),
    systemSettings: readonly(systemSettings),
    isLoading: readonly(isLoading),
    error: readonly(error),
    refresh,
  };
}

/**
 * Vue composable for checking proxy server availability
 */
export function useProxyStatus(options?: AudioProxyOptions) {
  const isAvailable = ref<boolean | null>(null);
  const isChecking = ref(false);
  const error = ref<string | null>(null);
  const proxyUrl = ref<string>('');

  const client = new AudioProxyClient(options);
  let requestGeneration = 0;

  const refresh = async () => {
    const requestId = ++requestGeneration;
    isChecking.value = true;
    error.value = null;

    try {
      const available = await client.isProxyAvailable();
      if (requestId !== requestGeneration) return;
      isAvailable.value = available;
      proxyUrl.value = client.getProxyUrl();
    } catch (err) {
      if (requestId === requestGeneration) {
        error.value = getErrorMessage(err);
        isAvailable.value = false;
      }
    } finally {
      if (requestId === requestGeneration) {
        isChecking.value = false;
      }
    }
  };

  onMounted(() => {
    refresh();
  });
  registerScopeCleanup(() => {
    requestGeneration += 1;
  });

  return {
    isAvailable: readonly(isAvailable),
    isChecking: readonly(isChecking),
    error: readonly(error),
    proxyUrl: readonly(proxyUrl),
    refresh,
  };
}

/**
 * Vue composable for audio metadata extraction (Tauri/Electron only)
 */
export function useAudioMetadata(filePath: Ref<string | null> | string | null) {
  const metadata = ref<{
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
    format?: string;
  } | null>(null);

  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const filePathRef = isRef(filePath)
    ? (filePath as Ref<string | null>)
    : ref(filePath);
  const client = new AudioProxyClient();
  let requestGeneration = 0;

  const getMetadata = async (path: string) => {
    const requestId = ++requestGeneration;
    isLoading.value = true;
    error.value = null;
    metadata.value = null;

    try {
      const environment = client.getEnvironment();
      const service = createDesktopAudioService(environment);

      if (service) {
        const result = await service.getAudioMetadata(path);
        if (requestId === requestGeneration) {
          metadata.value = result;
        }
      } else {
        if (requestId === requestGeneration) {
          error.value =
            'Audio metadata extraction is only available in Tauri or Electron environments';
        }
      }
    } catch (err) {
      if (requestId === requestGeneration) {
        error.value = getErrorMessage(err);
      }
    } finally {
      if (requestId === requestGeneration) {
        isLoading.value = false;
      }
    }
  };

  watch(
    filePathRef,
    (newPath: string | null) => {
      if (newPath) {
        getMetadata(newPath);
      } else {
        requestGeneration += 1;
        metadata.value = null;
        error.value = null;
        isLoading.value = false;
      }
    },
    { immediate: true }
  );
  registerScopeCleanup(() => {
    requestGeneration += 1;
  });

  return {
    metadata: readonly(metadata),
    isLoading: readonly(isLoading),
    error: readonly(error),
  };
}

/**
 * Vue plugin for global audio proxy configuration
 */
export interface AudioProxyGlobalOptions {
  defaultOptions?: AudioProxyOptions;
}

export function createAudioProxy(globalOptions: AudioProxyGlobalOptions = {}) {
  return {
    install(app: App) {
      const client = new AudioProxyClient(globalOptions.defaultOptions);

      app.config.globalProperties.$audioProxy = client;
      app.provide(audioProxyInjectionKey, client);
      app.provide('audioProxyOptions', globalOptions.defaultOptions || {});
    },
  };
}

/**
 * Composable to inject the global audio proxy client
 */
export function useGlobalAudioProxy() {
  const client = inject(audioProxyInjectionKey);
  if (!client) {
    throw new Error(
      'AudioProxy plugin must be installed to use useGlobalAudioProxy'
    );
  }
  return client as AudioProxyClient;
}
