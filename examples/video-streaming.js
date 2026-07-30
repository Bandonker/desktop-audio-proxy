import { createAudioClient, startProxyServer } from 'desktop-audio-proxy';
import { pathToFileURL } from 'node:url';

const MEDIA_HOSTS = [
  'commondatastorage.googleapis.com',
  'demo.unified-streaming.com',
];

async function withSecureProxy(callback) {
  const proxyServer = await startProxyServer({
    host: '127.0.0.1',
    port: 0,
    allowedHosts: MEDIA_HOSTS,
    allowPrivateAddresses: false,
    enableLogging: false,
  });
  const client = createAudioClient({
    proxyUrl: proxyServer.getProxyUrl(),
    autoDetect: false,
    fallbackToOriginal: false,
  });

  try {
    return await callback(client);
  } finally {
    await proxyServer.stop();
  }
}

export async function prepareMp4Video() {
  return withSecureProxy(async client => {
    const source =
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    const playableUrl = await client.getPlayableUrl(source);
    console.log('MP4 proxy URL:', playableUrl);
    return playableUrl;
  });
}

export async function prepareHlsVideo() {
  return withSecureProxy(async client => {
    const source =
      'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8';
    const playableUrl = await client.getPlayableUrl(source);
    console.log('HLS proxy URL:', playableUrl);
    return playableUrl;
  });
}

export async function inspectVideoStream() {
  return withSecureProxy(async client => {
    const source =
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
    const info = await client.canPlayUrl(source);
    console.log({
      status: info.status,
      contentType: info.contentType,
      contentLength: info.contentLength,
      acceptRanges: info.acceptRanges,
      canPlay: info.canPlay,
    });
    return info;
  });
}

export async function runAllExamples() {
  await prepareMp4Video();
  await prepareHlsVideo();
  await inspectVideoStream();
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  runAllExamples().catch(error => {
    console.error('Video example failed:', error);
    process.exitCode = 1;
  });
}
