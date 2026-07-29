<script setup lang="ts">
import { ref } from 'vue';
import { useAudioProxy, useProxyStatus } from 'desktop-audio-proxy/vue';

const stations = [
  {
    name: 'Groove Salad',
    url: 'https://ice1.somafm.com/groovesalad-128-mp3',
  },
  {
    name: 'Drone Zone',
    url: 'https://ice2.somafm.com/dronezone-128-mp3',
  },
];

const proxyOptions = {
  proxyUrl: 'http://127.0.0.1:3002',
  autoDetect: false,
  autoStartProxy: false,
  fallbackToOriginal: false,
  retryAttempts: 2,
};
const draftUrl = ref(stations[0].url);
const stationUrl = ref<string | null>(null);
const { audioUrl, isLoading, error, retry, streamInfo } = useAudioProxy(
  stationUrl,
  proxyOptions
);
const {
  isAvailable,
  isChecking,
  refresh: refreshProxy,
} = useProxyStatus(proxyOptions);

function prepareStation() {
  const nextUrl = draftUrl.value.trim();
  if (nextUrl) stationUrl.value = nextUrl;
}

function selectStation(url: string) {
  draftUrl.value = url;
  stationUrl.value = url;
}
</script>

<template>
  <main>
    <h1>Secure desktop radio player</h1>
    <p>
      Proxy status:
      {{ isChecking ? 'checking…' : isAvailable ? 'available' : 'offline' }}
      <button type="button" @click="refreshProxy">Refresh</button>
    </p>

    <form @submit.prevent="prepareStation">
      <label for="station-url">Station URL</label>
      <input id="station-url" v-model="draftUrl" type="url" required />
      <button type="submit">Prepare station</button>
    </form>

    <div aria-label="Example stations">
      <button
        v-for="station in stations"
        :key="station.url"
        type="button"
        @click="selectStation(station.url)"
      >
        {{ station.name }}
      </button>
    </div>

    <p v-if="isLoading" role="status">Preparing the proxied stream…</p>
    <p v-else-if="error" role="alert">
      {{ error }}
      <button type="button" @click="retry">Retry</button>
    </p>
    <audio v-if="audioUrl" :src="audioUrl" controls />
    <p v-if="streamInfo">
      Upstream status {{ streamInfo.status }};
      {{ streamInfo.contentType ?? 'unknown media type' }}
    </p>
  </main>
</template>

<style scoped>
main {
  max-width: 48rem;
  margin: 2rem auto;
  font-family: system-ui, sans-serif;
}

form,
[aria-label='Example stations'] {
  display: flex;
  gap: 0.75rem;
  margin: 1rem 0;
}

input,
audio {
  width: 100%;
}
</style>
