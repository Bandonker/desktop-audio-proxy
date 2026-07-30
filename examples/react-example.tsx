import { type FormEvent, useMemo, useState } from 'react';
import { useAudioUrl, useProxyStatus } from 'desktop-audio-proxy/react';

const STATIONS = [
  {
    name: 'Groove Salad',
    url: 'https://ice1.somafm.com/groovesalad-128-mp3',
  },
  {
    name: 'Drone Zone',
    url: 'https://ice2.somafm.com/dronezone-128-mp3',
  },
] as const;

export default function RadioPlayer() {
  const proxyOptions = useMemo(
    () => ({
      proxyUrl: 'http://127.0.0.1:3002',
      autoDetect: false,
      autoStartProxy: false,
      fallbackToOriginal: false,
      retryAttempts: 2,
    }),
    []
  );
  const [draftUrl, setDraftUrl] = useState<string>(STATIONS[0].url);
  const [stationUrl, setStationUrl] = useState<string | null>(null);
  const { playableUrl, loading, error, retry, streamInfo } = useAudioUrl(
    stationUrl,
    proxyOptions
  );
  const { isAvailable, isChecking, refresh } = useProxyStatus(proxyOptions);

  function selectStation(url: string) {
    setDraftUrl(url);
    setStationUrl(url);
  }

  function submitStation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUrl = draftUrl.trim();
    if (nextUrl) {
      setStationUrl(nextUrl);
    }
  }

  return (
    <main>
      <h1>Secure desktop radio player</h1>
      <p>
        Proxy status:{' '}
        {isChecking ? 'checking…' : isAvailable ? 'available' : 'offline'}
        <button type="button" onClick={refresh}>
          Refresh
        </button>
      </p>

      <form onSubmit={submitStation}>
        <label htmlFor="station-url">Station URL</label>
        <input
          id="station-url"
          type="url"
          value={draftUrl}
          onChange={event => setDraftUrl(event.target.value)}
          required
        />
        <button type="submit">Prepare station</button>
      </form>

      <div aria-label="Example stations">
        {STATIONS.map(station => (
          <button
            key={station.url}
            type="button"
            onClick={() => selectStation(station.url)}
          >
            {station.name}
          </button>
        ))}
      </div>

      {loading && <p role="status">Preparing the proxied stream…</p>}
      {error && (
        <p role="alert">
          {error.message}
          <button type="button" onClick={retry}>
            Retry
          </button>
        </p>
      )}
      {playableUrl && <audio src={playableUrl} controls />}
      {streamInfo && (
        <p>
          Upstream status {streamInfo.status};{' '}
          {streamInfo.contentType ?? 'unknown media type'}
        </p>
      )}
    </main>
  );
}
