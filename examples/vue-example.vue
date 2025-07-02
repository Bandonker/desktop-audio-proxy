<template>
  <div>
    <h1>Desktop Audio Proxy - Vue Example</h1>
    
    <!-- Basic Audio Player -->
    <section>
      <h2>Basic Audio Player</h2>
      <input 
        v-model="audioUrl" 
        placeholder="Enter audio URL..."
        @input="updateUrl"
      />
      
      <div v-if="isLoading">Loading...</div>
      <div v-else-if="error">
        Error: {{ error }}
        <button @click="retry">Retry</button>
      </div>
      <div v-else-if="processedAudioUrl">
        <audio controls :src="processedAudioUrl" />
        <div v-if="streamInfo">
          <p>Status: {{ streamInfo.status }}</p>
          <p>Content Type: {{ streamInfo.contentType }}</p>
          <p>Requires Proxy: {{ streamInfo.requiresProxy ? 'Yes' : 'No' }}</p>
        </div>
      </div>
    </section>

    <!-- System Capabilities -->
    <section>
      <h2>System Audio Capabilities</h2>
      <button @click="refreshCapabilities">Refresh</button>
      
      <div v-if="capabilitiesLoading">Loading capabilities...</div>
      <div v-else-if="capabilitiesError">Error: {{ capabilitiesError }}</div>
      <div v-else-if="capabilities">
        <h3>Environment: {{ capabilities.environment }}</h3>
        
        <h4>Supported Formats:</h4>
        <ul>
          <li v-for="format in capabilities.supportedFormats" :key="format">
            {{ format }}
          </li>
        </ul>
        
        <h4>Missing Codecs:</h4>
        <ul>
          <li v-for="codec in capabilities.missingCodecs" :key="codec">
            {{ codec }}
          </li>
        </ul>
        
        <p v-if="capabilities.electronVersion">
          Electron Version: {{ capabilities.electronVersion }}
        </p>
      </div>
      
      <div v-if="devices">
        <h4>Audio Devices:</h4>
        <div>
          <h5>Input Devices:</h5>
          <ul>
            <li v-for="device in devices.inputDevices" :key="device.id">
              {{ device.name }} ({{ device.id }})
            </li>
          </ul>
          
          <h5>Output Devices:</h5>
          <ul>
            <li v-for="device in devices.outputDevices" :key="device.id">
              {{ device.name }} ({{ device.id }})
            </li>
          </ul>
        </div>
      </div>
      
      <div v-if="systemSettings">
        <h4>System Settings:</h4>
        <p>Default Input: {{ systemSettings.defaultInputDevice }}</p>
        <p>Default Output: {{ systemSettings.defaultOutputDevice }}</p>
        <p>Master Volume: {{ systemSettings.masterVolume }}%</p>
      </div>
    </section>

    <!-- Proxy Status -->
    <section>
      <h2>Proxy Server Status</h2>
      <p>Proxy URL: {{ proxyUrl }}</p>
      
      <div v-if="proxyChecking">Checking proxy status...</div>
      <div v-else>
        <p>Status: {{ proxyAvailable ? '✅ Available' : '❌ Unavailable' }}</p>
        <p v-if="proxyError">Error: {{ proxyError }}</p>
        <button @click="refreshProxy">Refresh</button>
      </div>
    </section>

    <!-- Audio Metadata -->
    <section>
      <h2>Audio Metadata (Tauri/Electron only)</h2>
      <input 
        v-model="filePath" 
        placeholder="Enter file path..."
      />
      
      <div v-if="metadataLoading">Loading metadata...</div>
      <div v-else-if="metadataError">Error: {{ metadataError }}</div>
      <div v-else-if="metadata">
        <p>Duration: {{ metadata.duration }}s</p>
        <p>Bitrate: {{ metadata.bitrate }} kbps</p>
        <p>Sample Rate: {{ metadata.sampleRate }} Hz</p>
        <p>Channels: {{ metadata.channels }}</p>
        <p>Format: {{ metadata.format }}</p>
      </div>
    </section>

    <!-- Multiple Audio Players Example -->
    <section>
      <h2>Multiple Audio Players</h2>
      <p><em>Note: In a real application, you would create a separate AudioPlayer.vue component (see example in comments below)</em></p>
      <div 
        v-for="(url, index) in audioUrls" 
        :key="index"
        style="border: 1px solid #ccc; margin: 10px; padding: 10px;"
      >
        <h3>Song {{ index + 1 }}</h3>
        <p>URL: {{ url }}</p>
        <p><em>Each would use useAudioProxy(ref(url)) individually</em></p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { 
  useAudioProxy, 
  useAudioCapabilities, 
  useProxyStatus, 
  useAudioMetadata 
} from 'desktop-audio-proxy/vue';

// Basic audio player state
const audioUrl = ref('https://example.com/audio.mp3');
const urlRef = ref(audioUrl.value);

const updateUrl = () => {
  urlRef.value = audioUrl.value;
};

const { 
  audioUrl: processedAudioUrl, 
  isLoading, 
  error, 
  streamInfo, 
  retry 
} = useAudioProxy(urlRef);

// System capabilities
const { 
  capabilities, 
  devices, 
  systemSettings, 
  isLoading: capabilitiesLoading, 
  error: capabilitiesError, 
  refresh: refreshCapabilities 
} = useAudioCapabilities();

// Proxy status
const { 
  isAvailable: proxyAvailable, 
  isChecking: proxyChecking, 
  error: proxyError, 
  proxyUrl, 
  refresh: refreshProxy 
} = useProxyStatus();

// Audio metadata
const filePath = ref('/path/to/audio.mp3');
const { 
  metadata, 
  isLoading: metadataLoading, 
  error: metadataError 
} = useAudioMetadata(filePath);

// Multiple audio players
const audioUrls = reactive([
  'https://example.com/song1.mp3',
  'https://example.com/song2.mp3',
  'https://example.com/song3.mp3'
]);
</script>

<!-- 
  Individual Audio Player Component Example:
  This would be implemented as a separate .vue file in a real application.
  
  AudioPlayer.vue:
  <template>
    <div style="border: 1px solid #ccc; margin: 10px; padding: 10px;">
      <h3>{{ title }}</h3>
      <div v-if="isLoading">Loading...</div>
      <div v-else-if="error">Error: {{ error }}</div>
      <audio v-else-if="audioUrl" controls :src="audioUrl" />
    </div>
  </template>

  <script setup lang="ts">
  import { ref } from 'vue';
  import { useAudioProxy } from 'desktop-audio-proxy/vue';

  interface Props {
    url: string;
    title: string;
  }

  const props = defineProps<Props>();
  const { audioUrl, isLoading, error } = useAudioProxy(ref(props.url));
  </script>
-->

<style scoped>
section {
  margin: 20px 0;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

h2 {
  color: #333;
  border-bottom: 2px solid #007acc;
  padding-bottom: 10px;
}

input {
  width: 100%;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ccc;
  border-radius: 4px;
}

button {
  background-color: #007acc;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  margin: 5px;
}

button:hover {
  background-color: #005a9e;
}

audio {
  width: 100%;
  margin: 10px 0;
}

ul {
  list-style-type: disc;
  margin-left: 20px;
}

li {
  margin: 5px 0;
}
</style>