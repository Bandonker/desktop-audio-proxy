import {
  AudioProxyClient,
  configureMediaElementForCompatibility,
  ElectronAudioService,
  selectPlayableMediaSource,
  TauriAudioService,
} from '../../src/browser';

type SmokeHost = 'electron' | 'tauri' | 'web';

interface SmokeResult {
  ok: boolean;
  host: SmokeHost;
  environment?: string;
  engine?: string;
  nativeHls?: boolean;
  range?: boolean;
  contentRange?: string | null;
  playableUrl?: string;
  error?: string;
}

declare global {
  interface Window {
    nativeSmoke?: {
      report(result: SmokeResult): void;
    };
    __DAP_SMOKE_RESULT?: SmokeResult;
  }
}

async function getParameters(): Promise<{
  expectedHost: SmokeHost;
  proxyUrl: string;
  upstreamUrl: string;
}> {
  const parameters = new URLSearchParams(window.location.search);
  let expectedHost = parameters.get('host');
  let proxyUrl = parameters.get('proxy');
  let upstreamUrl = parameters.get('upstream');
  if (
    (!expectedHost || !proxyUrl || !upstreamUrl) &&
    window.__TAURI__?.core?.invoke
  ) {
    const nativeConfiguration = JSON.parse(
      String(await window.__TAURI__.core.invoke('smoke_config'))
    ) as {
      host?: string;
      proxy?: string;
      upstream?: string;
    };
    expectedHost = nativeConfiguration.host || null;
    proxyUrl = nativeConfiguration.proxy || null;
    upstreamUrl = nativeConfiguration.upstream || null;
  }
  if (
    (expectedHost !== 'electron' &&
      expectedHost !== 'tauri' &&
      expectedHost !== 'web') ||
    !proxyUrl ||
    !upstreamUrl
  ) {
    throw new Error('Native smoke parameters are incomplete');
  }
  return { expectedHost, proxyUrl, upstreamUrl };
}

async function report(result: SmokeResult): Promise<void> {
  document.body.dataset.status = result.ok ? 'passed' : 'failed';
  document.querySelector('#result')!.textContent = JSON.stringify(result);
  window.__DAP_SMOKE_RESULT = result;

  if (window.nativeSmoke) {
    window.nativeSmoke.report(result);
    return;
  }
  if (window.__TAURI__?.core?.invoke) {
    await window.__TAURI__.core.invoke('report_smoke', {
      result: JSON.stringify(result),
    });
  }
}

async function waitForMedia(element: HTMLMediaElement): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeoutMs = 30_000;
    const timeout = window.setTimeout(
      () =>
        reject(
          new Error(
            `Media metadata did not load within ${timeoutMs / 1_000} seconds ` +
              `(readyState=${element.readyState}, networkState=${element.networkState}, ` +
              `error=${element.error?.code ?? 'none'})`
          )
        ),
      timeoutMs
    );
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      element.removeEventListener('loadedmetadata', onLoaded);
      element.removeEventListener('canplay', onLoaded);
      element.removeEventListener('error', onError);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };
    const onLoaded = () => finish();
    const onError = () =>
      finish(
        new Error(`Media element failed with code ${element.error?.code}`)
      );
    element.addEventListener('loadedmetadata', onLoaded, { once: true });
    element.addEventListener('canplay', onLoaded, { once: true });
    element.addEventListener('error', onError, { once: true });
    element.load();
  });
}

async function run(): Promise<void> {
  const { expectedHost, proxyUrl, upstreamUrl } = await getParameters();
  const options = {
    proxyUrl,
    autoDetect: true,
    autoStartProxy: false,
    fallbackToOriginal: false,
    retryAttempts: 1,
    retryDelay: 0,
  };
  const service =
    expectedHost === 'electron'
      ? new ElectronAudioService(options)
      : expectedHost === 'tauri'
        ? new TauriAudioService(options)
        : new AudioProxyClient(options);
  const environment = service.getEnvironment();
  if (environment !== expectedHost) {
    throw new Error(
      `Expected ${expectedHost} environment, received ${environment}`
    );
  }
  if (!(await service.isProxyAvailable())) {
    throw new Error('Proxy health check failed');
  }

  const media = document.querySelector<HTMLAudioElement>('#player')!;
  const profile = configureMediaElementForCompatibility(media);
  const selected = selectPlayableMediaSource(media, [
    {
      url: `${upstreamUrl}/unsupported.bin`,
      type: 'audio/x-desktop-audio-proxy-unsupported',
    },
    { url: `${upstreamUrl}/tone.wav`, type: 'audio/wav' },
  ]);
  const playableUrl =
    service instanceof AudioProxyClient
      ? await service.getPlayableUrl(selected.url)
      : await service.getStreamableUrl(selected.url);
  const rangeResponse = await fetch(playableUrl, {
    headers: { Range: 'bytes=0-31' },
  });
  const contentRange = rangeResponse.headers.get('content-range');
  if (
    rangeResponse.status !== 206 ||
    !contentRange?.startsWith('bytes 0-31/')
  ) {
    throw new Error(
      `Range request failed: ${rangeResponse.status} ${contentRange || ''}`
    );
  }

  media.src = playableUrl;
  await waitForMedia(media);
  await report({
    ok: true,
    host: expectedHost,
    environment,
    engine: profile.engine,
    nativeHls: profile.nativeHls,
    range: true,
    contentRange,
    playableUrl,
  });
}

run().catch(error => {
  const fallbackHost =
    (new URLSearchParams(window.location.search).get('host') as SmokeHost) ||
    'web';
  void report({
    ok: false,
    host: fallbackHost,
    error: error instanceof Error ? error.message : String(error),
  });
});
