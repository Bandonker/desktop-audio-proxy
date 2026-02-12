/**
 * React Example: Desktop Audio Proxy Integration
 * 
 * This example demonstrates how to use desktop-audio-proxy with React.
 * 
 * To use this in a real project:
 * 1. Install dependencies: npm install react @types/react desktop-audio-proxy
 * 2. Replace the declare statements below with proper imports
 * 3. Use the hooks as shown in the examples below
 * 
 * Real imports would be:
 * import React, { useState } from 'react';
 * import { 
 *   useAudioProxy, 
 *   useAudioUrl,
 *   useAudioCapabilities, 
 *   useProxyStatus, 
 *   useAudioMetadata,
 *   AudioProxyProvider 
 * } from 'desktop-audio-proxy/react';
 */

// Demonstration declarations (replace with real imports in your project)
declare const React: any;
declare const useState: any;
declare const useAudioProxy: any;
declare const useAudioUrl: any;
declare const useAudioCapabilities: any;
declare const useProxyStatus: any;
declare const useAudioMetadata: any;
declare const AudioProxyProvider: any;

// Simplified usage example using useAudioUrl
function SimpleAudioPlayer() {
  const [url, setUrl] = useState('https://example.com/audio.mp3');
  const { playableUrl, loading, error, retry } = useAudioUrl(url);

  return React.createElement('div', null,
    React.createElement('h2', null, 'Simple Audio Player'),
    React.createElement('input', {
      value: url,
      onChange: (e: any) => setUrl(e.target.value),
      placeholder: 'Enter audio URL...'
    }),
    
    loading && React.createElement('p', null, 'Loading...'),
    error && React.createElement('div', null,
      React.createElement('p', null, 'Error: ', error.message),
      React.createElement('button', { onClick: retry }, 'Retry')
    ),
    
    playableUrl && React.createElement('div', null,
      React.createElement('audio', { controls: true, src: playableUrl })
    )
  );
}

// Basic usage example using useAudioProxy
function BasicAudioPlayer() {
  const [url, setUrl] = useState('https://example.com/audio.mp3');
  const { audioUrl, isLoading, error, streamInfo, retry } = useAudioProxy(url);

  return React.createElement('div', null,
    React.createElement('h2', null, 'Basic Audio Player'),
    React.createElement('input', {
      value: url,
      onChange: (e: any) => setUrl(e.target.value),
      placeholder: 'Enter audio URL...'
    }),
    
    isLoading && React.createElement('p', null, 'Loading...'),
    error && React.createElement('div', null,
      React.createElement('p', null, 'Error: ', error),
      React.createElement('button', { onClick: retry }, 'Retry')
    ),
    
    audioUrl && React.createElement('div', null,
      React.createElement('audio', { controls: true, src: audioUrl }),
      streamInfo && React.createElement('div', null,
        React.createElement('p', null, 'Status: ', streamInfo.status),
        React.createElement('p', null, 'Content Type: ', streamInfo.contentType),
        React.createElement('p', null, 'Requires Proxy: ', streamInfo.requiresProxy ? 'Yes' : 'No')
      )
    )
  );
}

// System capabilities example
function SystemCapabilities() {
  const { capabilities, devices, systemSettings, isLoading, error, refresh } = useAudioCapabilities();

  if (isLoading) return React.createElement('div', null, 'Loading capabilities...');
  if (error) return React.createElement('div', null, 'Error: ', error);

  return React.createElement('div', null,
    React.createElement('h2', null, 'System Audio Capabilities'),
    React.createElement('button', { onClick: refresh }, 'Refresh'),
    
    capabilities && React.createElement('div', null,
      React.createElement('h3', null, 'Environment: ', capabilities.environment),
      React.createElement('h4', null, 'Supported Formats:'),
      React.createElement('ul', null,
        capabilities.supportedFormats.map((format: string) => 
          React.createElement('li', { key: format }, format)
        )
      ),
      React.createElement('h4', null, 'Missing Codecs:'),
      React.createElement('ul', null,
        capabilities.missingCodecs.map((codec: string) => 
          React.createElement('li', { key: codec }, codec)
        )
      ),
      capabilities.electronVersion && 
        React.createElement('p', null, 'Electron Version: ', capabilities.electronVersion)
    ),
    
    devices && React.createElement('div', null,
      React.createElement('h4', null, 'Audio Devices:'),
      React.createElement('div', null,
        React.createElement('h5', null, 'Input Devices:'),
        React.createElement('ul', null,
          devices.inputDevices.map((device: any) => 
            React.createElement('li', { key: device.id }, device.name, ' (', device.id, ')')
          )
        ),
        React.createElement('h5', null, 'Output Devices:'),
        React.createElement('ul', null,
          devices.outputDevices.map((device: any) => 
            React.createElement('li', { key: device.id }, device.name, ' (', device.id, ')')
          )
        )
      )
    ),
    
    systemSettings && React.createElement('div', null,
      React.createElement('h4', null, 'System Settings:'),
      React.createElement('p', null, 'Default Input: ', systemSettings.defaultInputDevice),
      React.createElement('p', null, 'Default Output: ', systemSettings.defaultOutputDevice),
      React.createElement('p', null, 'Master Volume: ', systemSettings.masterVolume, '%')
    )
  );
}

// Proxy status example
function ProxyStatus() {
  const { isAvailable, isChecking, error, proxyUrl, refresh } = useProxyStatus();

  return React.createElement('div', null,
    React.createElement('h2', null, 'Proxy Server Status'),
    React.createElement('p', null, 'Proxy URL: ', proxyUrl),
    
    isChecking ? 
      React.createElement('p', null, 'Checking proxy status...') :
      React.createElement('div', null,
        React.createElement('p', null, 'Status: ', isAvailable ? '✅ Available' : '❌ Unavailable'),
        error && React.createElement('p', null, 'Error: ', error),
        React.createElement('button', { onClick: refresh }, 'Refresh')
      )
  );
}

// Audio metadata example (Tauri/Electron only)
function AudioMetadata() {
  const [filePath, setFilePath] = useState('/path/to/audio.mp3');
  const { metadata, isLoading, error } = useAudioMetadata(filePath);

  return React.createElement('div', null,
    React.createElement('h2', null, 'Audio Metadata'),
    React.createElement('input', {
      value: filePath,
      onChange: (e: any) => setFilePath(e.target.value),
      placeholder: 'Enter file path...'
    }),
    
    isLoading && React.createElement('p', null, 'Loading metadata...'),
    error && React.createElement('p', null, 'Error: ', error),
    
    metadata && React.createElement('div', null,
      React.createElement('p', null, 'Duration: ', metadata.duration, 's'),
      React.createElement('p', null, 'Bitrate: ', metadata.bitrate, ' kbps'),
      React.createElement('p', null, 'Sample Rate: ', metadata.sampleRate, ' Hz'),
      React.createElement('p', null, 'Channels: ', metadata.channels),
      React.createElement('p', null, 'Format: ', metadata.format)
    )
  );
}

// Advanced example with provider
function AdvancedExample() {
  return React.createElement(AudioProxyProvider, {
    options: { 
      proxyUrl: 'http://localhost:3002',
      retryAttempts: 3,
      fallbackToOriginal: true 
    }
  },
    React.createElement('div', null,
      React.createElement('h1', null, 'Desktop Audio Proxy - React Example'),
      React.createElement(BasicAudioPlayer),
      React.createElement(SystemCapabilities),
      React.createElement(ProxyStatus),
      React.createElement(AudioMetadata),
      React.createElement(MultipleAudioPlayers)
    )
  );
}

// Multiple audio players example  
function MultipleAudioPlayers() {
  const [urls] = useState([
    'https://example.com/song1.mp3',
    'https://example.com/song2.mp3', 
    'https://example.com/song3.mp3'
  ]);

  return React.createElement('div', null,
    React.createElement('h2', null, 'Multiple Audio Players'),
    urls.map((url: string, index: number) => 
      React.createElement(AudioPlayer, {
        key: index,
        url: url,
        title: `Song ${index + 1}`
      })
    )
  );
}

interface AudioPlayerProps {
  url: string;
  title: string;
}

function AudioPlayer({ url, title }: AudioPlayerProps) {
  const { audioUrl, isLoading, error } = useAudioProxy(url);

  return React.createElement('div', 
    { style: { border: '1px solid #ccc', margin: '10px', padding: '10px' } },
    React.createElement('h3', null, title),
    isLoading && React.createElement('p', null, 'Loading...'),
    error && React.createElement('p', null, 'Error: ', error),
    audioUrl && React.createElement('audio', { controls: true, src: audioUrl })
  );
}

export default AdvancedExample;