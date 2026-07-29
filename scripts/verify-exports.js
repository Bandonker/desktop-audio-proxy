import * as dap from '../dist/index.esm.js';
import * as browser from '../dist/browser.esm.js';

console.log('Testing exports from index.esm.js:');
console.log('AudioProxyServer:', typeof dap.AudioProxyServer);
console.log('createProxyServer:', typeof dap.createProxyServer);
console.log('startProxyServer:', typeof dap.startProxyServer);
console.log(
  'createMediaElementController:',
  typeof dap.createMediaElementController
);
console.log('detectMediaEngine:', typeof dap.detectMediaEngine);
console.log('selectPlayableMediaSource:', typeof dap.selectPlayableMediaSource);
console.log(
  'configureMediaElementForCompatibility:',
  typeof dap.configureMediaElementForCompatibility
);

if (
  dap.AudioProxyServer &&
  dap.createProxyServer &&
  dap.startProxyServer &&
  dap.createMediaElementController &&
  dap.detectMediaEngine &&
  dap.selectPlayableMediaSource &&
  dap.configureMediaElementForCompatibility
) {
  console.log('Server and media compatibility helpers are exported correctly.');
} else {
  console.error('Some public helpers are missing from exports.');
  process.exit(1);
}

if (
  typeof browser.createMediaElementController !== 'function' ||
  typeof browser.detectMediaEngine !== 'function' ||
  typeof browser.selectPlayableMediaSource !== 'function' ||
  typeof browser.configureMediaElementForCompatibility !== 'function'
) {
  console.error('Browser media compatibility exports are missing.');
  process.exit(1);
}

console.log('Browser media compatibility exports are available.');
