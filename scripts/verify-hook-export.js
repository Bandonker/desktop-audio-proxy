import { useAudioUrl } from '../dist/react.esm.js';

console.log('Testing useAudioUrl from react.esm.js:');
console.log('useAudioUrl:', typeof useAudioUrl);

if (typeof useAudioUrl === 'function') {
  console.log('useAudioUrl hook is exported correctly.');
} else {
  console.error('useAudioUrl hook is missing from exports.');
  process.exit(1);
}
