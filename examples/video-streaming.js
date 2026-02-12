/**
 * Video Streaming Examples for Desktop Audio Proxy
 * 
 * DAP supports all video formats through the same CORS-bypassing proxy:
 * - MP4, WebM, OGG video files
 * - M3U8/HLS adaptive streaming
 * - DASH manifests
 * - Range requests for seeking
 */

import { createAudioClient, startProxyServer } from 'desktop-audio-proxy';
import url from 'url';

// Example 1: Basic Video Streaming (MP4)
async function basicVideoStreaming() {
  console.log('=== Basic Video Streaming (MP4) ===\n');
  
  const client = createAudioClient({
    autoStartProxy: true,
    proxyServerConfig: { port: 3002 }
  });

  // Convert external video URL
  const videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  const playableUrl = await client.getPlayableUrl(videoUrl);
  
  console.log('Original URL:', videoUrl);
  console.log('Playable URL:', playableUrl);
  console.log('\nUse this URL in a <video> element:');
  console.log(`<video src="${playableUrl}" controls></video>\n`);
  
  await client.stopProxyServer();
}

// Example 2: M3U8/HLS Adaptive Streaming
async function hlsStreaming() {
  console.log('=== HLS/M3U8 Adaptive Streaming ===\n');
  
  const client = createAudioClient({
    autoStartProxy: true
  });

  // HLS playlist URL
  const hlsUrl = 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8';
  const playableUrl = await client.getPlayableUrl(hlsUrl);
  
  console.log('Original HLS URL:', hlsUrl);
  console.log('Proxied HLS URL:', playableUrl);
  console.log('\nThe proxy will handle:');
  console.log('  ✓ Master playlist');
  console.log('  ✓ Media playlists');
  console.log('  ✓ Video segments');
  console.log('  ✓ Adaptive bitrate switching\n');
  
  await client.stopProxyServer();
}

// Example 3: Video with Range Request Support (Seeking)
async function videoWithSeeking() {
  console.log('=== Video with Range Request Support ===\n');
  
  const proxyServer = await startProxyServer({ 
    port: 3002,
    enableLogging: true 
  });
  
  const client = createAudioClient({
    proxyUrl: 'http://localhost:3002'
  });

  const videoUrl = 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4';
  const playableUrl = await client.getPlayableUrl(videoUrl);
  
  console.log('Video URL with Range Support:', playableUrl);
  console.log('\nRange requests (seeking) are automatically supported.');
  console.log('The proxy forwards Range headers from your video player.\n');
  
  // Get video info
  const info = await client.getStreamInfo(videoUrl);
  console.log('Video Info:');
  console.log('  Content-Type:', info.contentType);
  console.log('  Content-Length:', info.contentLength);
  console.log('  Accept-Ranges:', info.acceptRanges);
  console.log('  Can Play:', info.canPlay);
  console.log('  Requires Proxy:', info.requiresProxy, '\n');
  
  await proxyServer.stop();
}

// Example 4: Mixed Audio and Video Content
async function mixedMediaContent() {
  console.log('=== Mixed Audio and Video Content ===\n');
  
  const client = createAudioClient({
    autoStartProxy: true,
    proxyServerConfig: { 
      port: 3002,
      corsOrigins: '*'
    }
  });

  const mediaUrls = [
    { type: 'audio', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { type: 'video', url: 'https://sample-videos.com/video321/mp4/480/big_buck_bunny_480p_1mb.mp4' },
    { type: 'hls', url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8' }
  ];

  console.log('Converting multiple media URLs:\n');
  
  for (const media of mediaUrls) {
    const playableUrl = await client.getPlayableUrl(media.url);
    console.log(`${media.type.toUpperCase()}:`);
    console.log(`  Original: ${media.url.substring(0, 60)}...`);
    console.log(`  Playable: ${playableUrl.substring(0, 80)}...\n`);
  }
  
  await client.stopProxyServer();
}

// Example 5: Video Metadata Extraction
async function videoMetadata() {
  console.log('=== Video Metadata Extraction ===\n');
  
  const client = createAudioClient({
    autoStartProxy: true
  });

  const videoUrl = 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_10mb.mp4';
  
  // Get detailed info without downloading the full video
  const info = await client.getStreamInfo(videoUrl);
  
  console.log('Video Metadata:');
  console.log('  URL:', videoUrl);
  console.log('  Status:', info.status);
  console.log('  Content-Type:', info.contentType);
  console.log('  Content-Length:', info.contentLength, 'bytes');
  console.log('  Accept-Ranges:', info.acceptRanges);
  console.log('  Last-Modified:', info.lastModified);
  console.log('  Can Play:', info.canPlay);
  console.log('  Requires Proxy:', info.requiresProxy);
  console.log('\nAll Headers:', JSON.stringify(info.headers, null, 2), '\n');
  
  await client.stopProxyServer();
}

// Example 6: Direct Proxy Server Usage (Advanced)
async function directProxyUsage() {
  console.log('=== Direct Proxy Server Usage ===\n');
  
  const proxyServer = await startProxyServer({ 
    port: 3002,
    enableLogging: false,
    timeout: 120000, // 2 minutes for large videos
    maxRedirects: 20
  });

  const proxyUrl = proxyServer.getProxyUrl();
  console.log('Proxy Server Running:', proxyUrl);
  console.log('\nDirect Usage Examples:\n');
  
  const videoUrl = 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_5mb.mp4';
  const encodedUrl = encodeURIComponent(videoUrl);
  
  console.log('1. Stream Video:');
  console.log(`   ${proxyUrl}/proxy?url=${encodedUrl}\n`);
  
  console.log('2. Get Video Info:');
  console.log(`   ${proxyUrl}/info?url=${encodedUrl}\n`);
  
  console.log('3. Health Check:');
  console.log(`   ${proxyUrl}/health\n`);
  
  console.log('Use these URLs directly in <video> or <audio> elements.\n');
  
  await proxyServer.stop();
}

// Run all examples
async function runAllExamples() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     Desktop Audio Proxy - Video Streaming Examples      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    await basicVideoStreaming();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await hlsStreaming();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await videoWithSeeking();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await mixedMediaContent();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await videoMetadata();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await directProxyUsage();
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('All examples completed successfully!');
    console.log('═══════════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run examples if called directly
if (process.argv[1] && url.pathToFileURL(process.argv[1]).href === import.meta.url) {
  runAllExamples();
}

export {
  basicVideoStreaming,
  hlsStreaming,
  videoWithSeeking,
  mixedMediaContent,
  videoMetadata,
  directProxyUsage,
  runAllExamples
};
