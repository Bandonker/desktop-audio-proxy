import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AudioProxyClient } from './client';
import { TauriAudioService } from './tauri-service';
import { ElectronAudioService } from './electron-service';
import { AudioProxyOptions, StreamInfo, Environment } from './types';

type DesktopAudioService = TauriAudioService | ElectronAudioService;

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
 * Hook for managing audio proxy client with automatic URL processing
 */
export function useAudioProxy(url: string | null, options?: AudioProxyOptions) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);

  // Memoize options with deep comparison to prevent unnecessary client recreations
  const optionsJson = JSON.stringify(options ?? {});
  const stableOptions = useMemo(() => {
    return JSON.parse(optionsJson) as AudioProxyOptions;
  }, [optionsJson]);

  // Memoize client to prevent unnecessary recreations
  const client = useMemo(
    () => new AudioProxyClient(stableOptions),
    [stableOptions]
  );

  const processUrl = useCallback(
    async (inputUrl: string) => {
      setIsLoading(true);
      setError(null);
      setAudioUrl(null);
      setStreamInfo(null);

      try {
        // Get stream info first
        const info = await client.canPlayUrl(inputUrl);
        setStreamInfo(info);

        // Get playable URL
        const playableUrl = await client.getPlayableUrl(inputUrl);
        setAudioUrl(playableUrl);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  useEffect(() => {
    if (url) {
      processUrl(url);
    } else {
      setAudioUrl(null);
      setStreamInfo(null);
      setError(null);
      setIsLoading(false);
    }
  }, [url, processUrl]);

  const retry = useCallback(() => {
    if (url) {
      processUrl(url);
    }
  }, [url, processUrl]);

  return {
    audioUrl,
    isLoading,
    error,
    streamInfo,
    retry,
    client,
  };
}

/**
 * Hook for accessing audio capabilities and system information
 */
export function useAudioCapabilities() {
  const [capabilities, setCapabilities] = useState<{
    supportedFormats: string[];
    missingCodecs: string[];
    capabilities: Record<string, string>;
    environment: Environment;
    electronVersion?: string;
    chromiumVersion?: string;
  } | null>(null);

  const [devices, setDevices] = useState<{
    inputDevices: Array<{ id: string; name: string }>;
    outputDevices: Array<{ id: string; name: string }>;
  } | null>(null);

  const [systemSettings, setSystemSettings] = useState<{
    defaultInputDevice?: string;
    defaultOutputDevice?: string;
    masterVolume?: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => new AudioProxyClient(), []);

  const refreshCapabilities = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const environment = client.getEnvironment();
      const service = createDesktopAudioService(environment);

      if (service) {
        // Get codec capabilities
        const codecInfo = await service.checkSystemCodecs();
        setCapabilities({
          ...codecInfo,
          environment,
        });

        // Get audio devices
        const deviceInfo = await service.getAudioDevices();
        if (deviceInfo) {
          setDevices(deviceInfo);
        }

        // Get system settings (Electron only)
        if (environment === 'electron' && 'getSystemAudioSettings' in service) {
          const settings = await (
            service as ElectronAudioService
          ).getSystemAudioSettings();
          if (settings) {
            setSystemSettings(settings);
          }
        }
      } else {
        // Basic web environment capabilities
        const audio = new Audio();
        const supportedFormats = WEB_AUDIO_FORMATS.filter(
          format => audio.canPlayType(WEB_AUDIO_MIME_TYPES[format]) !== ''
        );

        setCapabilities({
          supportedFormats,
          missingCodecs: WEB_AUDIO_FORMATS.filter(
            format => !supportedFormats.includes(format)
          ),
          capabilities: {},
          environment,
        });
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    refreshCapabilities();
  }, [refreshCapabilities]);

  return {
    capabilities,
    devices,
    systemSettings,
    isLoading,
    error,
    refresh: refreshCapabilities,
  };
}

/**
 * Hook for checking proxy server availability
 */
export function useProxyStatus(options?: AudioProxyOptions) {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proxyUrl, setProxyUrl] = useState<string>('');

  const client = useMemo(() => new AudioProxyClient(options), [options]);

  const checkProxy = useCallback(async () => {
    setIsChecking(true);
    setError(null);

    try {
      const available = await client.isProxyAvailable();
      setIsAvailable(available);
      setProxyUrl(client.getProxyUrl());
    } catch (err) {
      setError(getErrorMessage(err));
      setIsAvailable(false);
    } finally {
      setIsChecking(false);
    }
  }, [client]);

  useEffect(() => {
    checkProxy();
  }, [checkProxy]);

  return {
    isAvailable,
    isChecking,
    error,
    proxyUrl,
    refresh: checkProxy,
  };
}

/**
 * Hook for audio metadata extraction (Tauri/Electron only)
 */
export function useAudioMetadata(filePath: string | null) {
  const [metadata, setMetadata] = useState<{
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
    format?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => new AudioProxyClient(), []);

  useEffect(() => {
    if (!filePath) {
      setMetadata(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const getMetadata = async () => {
      setIsLoading(true);
      setError(null);
      setMetadata(null);

      try {
        const environment = client.getEnvironment();
        const service = createDesktopAudioService(environment);

        if (service) {
          const result = await service.getAudioMetadata(filePath);
          setMetadata(result);
        } else {
          setError(
            'Audio metadata extraction is only available in Tauri or Electron environments'
          );
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    };

    getMetadata();
  }, [filePath, client]);

  return {
    metadata,
    isLoading,
    error,
  };
}

/**
 * Context provider for global audio proxy configuration
 */

interface AudioProxyContextValue {
  defaultOptions: AudioProxyOptions;
  client: AudioProxyClient;
}

const AudioProxyContext = createContext<AudioProxyContextValue | null>(null);

export function AudioProxyProvider({
  children,
  options = {},
}: {
  children: ReactNode;
  options?: AudioProxyOptions;
}) {
  const client = useMemo(() => new AudioProxyClient(options), [options]);

  const value = useMemo(
    () => ({
      defaultOptions: options,
      client,
    }),
    [options, client]
  );

  return createElement(AudioProxyContext.Provider, { value }, children);
}

export function useAudioProxyContext() {
  const context = useContext(AudioProxyContext);
  if (!context) {
    throw new Error(
      'useAudioProxyContext must be used within an AudioProxyProvider'
    );
  }
  return context;
}

/**
 * Simplified hook that returns a playable URL from an audio file path
 * Wrapper around useAudioProxy with a cleaner API
 */
export function useAudioUrl(url: string | null, options?: AudioProxyOptions) {
  const result = useAudioProxy(url, options);

  return {
    playableUrl: result.audioUrl,
    loading: result.isLoading,
    error: result.error ? new Error(result.error) : null,
    streamInfo: result.streamInfo,
    retry: result.retry,
    client: result.client,
  };
}
