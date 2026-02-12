import { useAudioProxy } from '../dist/vue.esm.js';

console.log('Testing useAudioProxy from vue.esm.js:');
console.log('useAudioProxy:', typeof useAudioProxy);

if (typeof useAudioProxy === 'function') {
  console.log('Vue hook export is available.');
} else {
  console.error('useAudioProxy export is missing from vue bundle.');
  process.exit(1);
}
