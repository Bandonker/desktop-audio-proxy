/**
 * Integration test - Tests server and client working together
 */

const { startProxyServer } = require('../dist/server.cjs');
const { createAudioClient } = require('../dist/index.cjs');

// Mock window for testing
global.window = {
  location: { hostname: 'localhost', port: '3000' }
};

async function integrationTest() {
  console.log('🧪 Running Integration Test...\n');
  
  let server;
  
  try {
    // 1. Start proxy server
    console.log('1. Starting proxy server...');
    server = await startProxyServer({ 
      port: 3003, 
      enableLogging: false // Reduce noise 
    });
    console.log('✅ Server started on port 3003\n');
    
    // 2. Create client
    console.log('2. Creating audio client...');
    const client = createAudioClient({
      proxyUrl: 'http://localhost:3003',
      autoDetect: true
    });
    console.log('✅ Client created\n');
    
    // 3. Test proxy availability
    console.log('3. Testing proxy availability...');
    const isAvailable = await client.isProxyAvailable();
    console.log('✅ Proxy available:', isAvailable, '\n');
    
    // 4. Test local URL (should not use proxy)
    console.log('4. Testing local URL...');
    const localUrl = '/path/to/local.mp3';
    const localResult = await client.getPlayableUrl(localUrl);
    console.log('✅ Local URL:', localUrl, '->', localResult, '\n');
    
    // 5. Test external URL (should use proxy)
    console.log('5. Testing external URL...');
    const externalUrl = 'https://example.com/audio.mp3';
    const externalResult = await client.getPlayableUrl(externalUrl);
    console.log('✅ External URL:', externalUrl);
    console.log('   Result:', externalResult);
    console.log('   Uses proxy:', externalResult.includes('localhost:3003'), '\n');
    
    // 6. Test stream info
    console.log('6. Testing stream info...');
    const streamInfo = await client.canPlayUrl(externalUrl);
    console.log('✅ Stream info:', {
      canPlay: streamInfo.canPlay,
      requiresProxy: streamInfo.requiresProxy,
      status: streamInfo.status
    }, '\n');
    
    console.log('🎉 Integration test passed!\n');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (server) {
      console.log('🧹 Cleaning up...');
      await server.stop();
      console.log('✅ Server stopped');
    }
  }
}

integrationTest();