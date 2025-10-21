import {
  ref,
  watch,
  onMounted,
  inject,
  readonly,
  type Ref,
  type App,
} from 'vue';
import {
  AudioProxyClient,
  TauriAudioService,
  ElectronAudioService,
} from './index';
import { AudioProxyOptions, StreamInfo, Environment } from './types';

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
  const urlRef = ref(url);
  const client = new AudioProxyClient(options);

  const processUrl = async (inputUrl: string) => {
    isLoading.value = true;
    error.value = null;
    audioUrl.value = null;
    streamInfo.value = null;

    try {
      // Get stream info first
      const info = await client.canPlayUrl(inputUrl);
      streamInfo.value = info;

      // Get playable URL
      const playableUrl = await client.getPlayableUrl(inputUrl);
      audioUrl.value = playableUrl;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      error.value = errorMessage;
    } finally {
      isLoading.value = false;
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
    (newUrl: string) => {
      if (newUrl) {
        processUrl(newUrl);
      } else {
        audioUrl.value = null;
        streamInfo.value = null;
        error.value = null;
        isLoading.value = false;
      }
    },
    { immediate: true }
  );

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

  const refresh = async () => {
    isLoading.value = true;
    error.value = null;

    try {
      const environment = client.getEnvironment();
      let service: TauriAudioService | ElectronAudioService | null = null;

      if (environment === 'tauri') {
        service = new TauriAudioService();
      } else if (environment === 'electron') {
        service = new ElectronAudioService();
      }

      if (service) {
        // Get codec capabilities
        const codecInfo = await service.checkSystemCodecs();
        capabilities.value = {
          ...codecInfo,
          environment,
        };

        // Get audio devices
        const deviceInfo = await service.getAudioDevices();
        if (deviceInfo) {
          devices.value = deviceInfo;
        }

        // Get system settings (Electron only)
        if (environment === 'electron' && 'getSystemAudioSettings' in service) {
          const settings = await (
            service as ElectronAudioService
          ).getSystemAudioSettings();
          if (settings) {
            systemSettings.value = settings;
          }
        }
      } else {
        // Basic web environment capabilities
        const audio = new Audio();
        const formats = ['MP3', 'OGG', 'WAV', 'AAC', 'FLAC', 'WEBM', 'M4A'];
        const supportedFormats = formats.filter(format => {
          const mimeTypes = {
            MP3: 'audio/mpeg',
            OGG: 'audio/ogg',
            WAV: 'audio/wav',
            AAC: 'audio/aac',
            FLAC: 'audio/flac',
            WEBM: 'audio/webm',
            M4A: 'audio/mp4',
          };
          return (
            audio.canPlayType(mimeTypes[format as keyof typeof mimeTypes]) !==
            ''
          );
        });

        capabilities.value = {
          supportedFormats,
          missingCodecs: formats.filter(f => !supportedFormats.includes(f)),
          capabilities: {},
          environment,
        };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      error.value = errorMessage;
    } finally {
      isLoading.value = false;
    }
  };

  onMounted(() => {
    refresh();
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

  const refresh = async () => {
    isChecking.value = true;
    error.value = null;

    try {
      const available = await client.isProxyAvailable();
      isAvailable.value = available;
      proxyUrl.value = client.getProxyUrl();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      error.value = errorMessage;
      isAvailable.value = false;
    } finally {
      isChecking.value = false;
    }
  };

  onMounted(() => {
    refresh();
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

  const filePathRef = ref(filePath);
  const client = new AudioProxyClient();

  const getMetadata = async (path: string) => {
    isLoading.value = true;
    error.value = null;
    metadata.value = null;

    try {
      const environment = client.getEnvironment();
      let service: TauriAudioService | ElectronAudioService | null = null;

      if (environment === 'tauri') {
        service = new TauriAudioService();
      } else if (environment === 'electron') {
        service = new ElectronAudioService();
      }

      if (service) {
        const result = await service.getAudioMetadata(path);
        metadata.value = result;
      } else {
        error.value =
          'Audio metadata extraction is only available in Tauri or Electron environments';
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      error.value = errorMessage;
    } finally {
      isLoading.value = false;
    }
  };

  watch(
    filePathRef,
    (newPath: string) => {
      if (newPath) {
        getMetadata(newPath);
      } else {
        metadata.value = null;
        error.value = null;
        isLoading.value = false;
      }
    },
    { immediate: true }
  );

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
      app.provide('audioProxy', client);
      app.provide('audioProxyOptions', globalOptions.defaultOptions || {});
    },
  };
}

/**
 * Injection key for dependency injection
 */
export const audioProxyInjectionKey = Symbol('audioProxy');

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
