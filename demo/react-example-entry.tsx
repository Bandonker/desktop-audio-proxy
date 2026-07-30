import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { useAudioUrl, useProxyStatus } from '../src/react';

const STATIONS = [
  {
    name: 'Groove Salad',
    description: 'Ambient and downtempo',
    url: 'https://ice1.somafm.com/groovesalad-128-mp3',
  },
  {
    name: 'Drone Zone',
    description: 'Atmospheric textures',
    url: 'https://ice2.somafm.com/dronezone-128-mp3',
  },
];

function RadioPlayerDemo() {
  const options = useMemo(
    () => ({
      proxyUrl: 'http://localhost:3002',
      autoDetect: false,
      autoStartProxy: false,
      fallbackToOriginal: false,
      retryAttempts: 2,
    }),
    []
  );
  const [stationUrl, setStationUrl] = useState<string | null>(null);
  const { playableUrl, loading, error, streamInfo, retry } = useAudioUrl(
    stationUrl,
    options
  );
  const { isAvailable, isChecking, refresh } = useProxyStatus(options);

  return (
    <main className="react-radio">
      <div className="react-status">
        <span>React hook consumer</span>
        <strong>
          {isChecking
            ? 'Checking proxy…'
            : isAvailable
              ? 'Proxy ready'
              : 'Proxy offline'}
        </strong>
        <button type="button" onClick={refresh}>
          Refresh
        </button>
      </div>

      <div className="station-grid">
        {STATIONS.map(station => (
          <button
            key={station.url}
            className={stationUrl === station.url ? 'selected' : ''}
            type="button"
            onClick={() => setStationUrl(station.url)}
          >
            <span>{station.name}</span>
            <small>{station.description}</small>
          </button>
        ))}
      </div>

      <section className="player-panel">
        {loading && <p role="status">Preparing secure proxy URL…</p>}
        {error && (
          <p role="alert">
            {error.message}{' '}
            <button type="button" onClick={retry}>
              Retry
            </button>
          </p>
        )}
        {!loading && !error && !playableUrl && (
          <p>Choose a station to prepare playback.</p>
        )}
        {playableUrl && <audio src={playableUrl} controls />}
        {streamInfo && (
          <dl>
            <div>
              <dt>HTTP</dt>
              <dd>{streamInfo.status}</dd>
            </div>
            <div>
              <dt>Media</dt>
              <dd>{streamInfo.contentType ?? 'unknown'}</dd>
            </div>
            <div>
              <dt>Range</dt>
              <dd>{streamInfo.acceptRanges ?? 'not advertised'}</dd>
            </div>
          </dl>
        )}
      </section>
    </main>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('React demo root was not found');
ReactDOM.createRoot(rootElement).render(<RadioPlayerDemo />);
