import * as dap from '../dist/index.esm.js';

console.log('Testing exports from index.esm.js:');
console.log('AudioProxyServer:', typeof dap.AudioProxyServer);
console.log('createProxyServer:', typeof dap.createProxyServer);
console.log('startProxyServer:', typeof dap.startProxyServer);

if (dap.AudioProxyServer && dap.createProxyServer && dap.startProxyServer) {
  console.log('All server helpers are exported correctly.');
} else {
  console.error('Some server helpers are missing from exports.');
  process.exit(1);
}
