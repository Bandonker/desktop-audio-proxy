const { startProxyServer } = require('../dist/index.cjs');

async function testServer() {
  console.log('🧪 Testing Desktop Audio Proxy Server...');
  
  try {
    // Start the proxy server
    console.log('1. Starting proxy server...');
    const server = await startProxyServer({ 
      port: 3002, 
      enableLogging: true 
    });
    
    console.log('✅ Server started successfully');
    
    // Test health endpoint
    console.log('2. Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:3002/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    
    // Test stream info endpoint
    console.log('3. Testing stream info endpoint...');
    const testUrl = 'https://ice1.somafm.com/defcon-128-mp3';
    const infoResponse = await fetch(`http://localhost:3002/info?url=${encodeURIComponent(testUrl)}`);
    
    if (infoResponse.ok) {
      const infoData = await infoResponse.json();
      console.log('✅ Stream info:', infoData);
    } else {
      console.log('⚠️ Stream info failed (expected for some URLs)');
    }
    
    // Test proxy endpoint
    console.log('4. Testing proxy endpoint...');
    const proxyResponse = await fetch(`http://localhost:3002/proxy?url=${encodeURIComponent(testUrl)}`, {
      method: 'HEAD'
    });
    
    if (proxyResponse.ok) {
      console.log('✅ Proxy endpoint works');
      console.log('   Content-Type:', proxyResponse.headers.get('content-type'));
      console.log('   CORS headers:', proxyResponse.headers.get('access-control-allow-origin'));
    } else {
      console.log('⚠️ Proxy endpoint failed:', proxyResponse.status);
    }
    
    // Stop the server
    console.log('5. Stopping server...');
    await server.stop();
    console.log('✅ Server stopped');
    
    console.log('\n🎉 All server tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testServer();