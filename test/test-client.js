const { createAudioClient } = require('../dist/index.cjs');

// Mock window object for testing
global.window = {
  location: {
    hostname: 'localhost',
    port: '3000'
  }
};

async function testClient() {
  console.log('🧪 Testing Desktop Audio Proxy Client...');
  
  try {
    // Create client
    console.log('1. Creating audio client...');
    const client = createAudioClient({
      proxyUrl: 'http://localhost:3002',
      autoDetect: true,
      fallbackToOriginal: true
    });
    
    console.log('✅ Client created');
    console.log('   Environment:', client.getEnvironment());
    
    // Test local URL handling
    console.log('2. Testing local URL handling...');
    const localUrl = '/path/to/local/file.mp3';
    const localResult = await client.getPlayableUrl(localUrl);
    console.log('✅ Local URL:', localUrl, '->', localResult);
    
    // Test external URL without proxy
    console.log('3. Testing external URL (no proxy)...');
    const externalUrl = 'https://example.com/audio.mp3';
    try {
      const externalResult = await client.getPlayableUrl(externalUrl);
      console.log('✅ External URL:', externalUrl, '->', externalResult);
    } catch (error) {
      console.log('⚠️ External URL failed (expected without proxy):', error.message);
    }
    
    // Test URL validation
    console.log('4. Testing URL validation...');
    const streamInfo = await client.canPlayUrl('https://example.com/test.mp3');
    console.log('✅ Stream info:', streamInfo);
    
    console.log('\n🎉 All client tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testClient();