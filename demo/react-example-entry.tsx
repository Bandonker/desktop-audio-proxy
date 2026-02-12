import React from 'react';
import ReactDOM from 'react-dom/client';
import { useAudioUrl } from '../src/react';

// Copied/adapted components from examples/react-example.tsx
export function BasicVideoPlayer({ videoUrl }) {
  const { playableUrl, loading, error } = useAudioUrl(videoUrl, {
    autoStartProxy: true,
    fallbackToOriginal: true
  });

  if (loading) return React.createElement('div', { style: { padding: 20, textAlign: 'center' } }, 'Loading video...');
  if (error) return React.createElement('div', { style: { padding: 20, color: 'red' } }, React.createElement('strong', null, 'Error loading video:'), React.createElement('div', null, error.message));

  return React.createElement('video', { src: playableUrl, controls: true, style: { width: '100%', maxWidth: '800px' } }, 'Your browser does not support the video tag.');
}

export function AdvancedVideoPlayer({ videoUrl }) {
  const videoRef = React.useRef(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(1);

  const { playableUrl, loading, error, streamInfo } = useAudioUrl(videoUrl, {
    autoStartProxy: true,
    retryAttempts: 3,
    retryDelay: 1000
  });

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause(); else videoRef.current.play();
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) videoRef.current.volume = vol;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) return React.createElement('div', null, 'Loading video...');
  if (error) return React.createElement('div', { style: { color: 'crimson' } }, 'Error: ' + error.message);

  return React.createElement('div', null,
    React.createElement('div', null, React.createElement('video', { ref: videoRef, src: playableUrl, controls: true, style: { width: '100%', background: '#000' } })),
    React.createElement('div', { style: { marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' } },
      React.createElement('button', { onClick: togglePlayPause }, isPlaying ? 'Pause' : 'Play'),
      React.createElement('div', null, `${formatTime(currentTime)} / ${formatTime(duration)}`),
      React.createElement('input', { type: 'range', min: 0, max: duration || 0, value: currentTime, onChange: handleSeek, style: { flex: 1 } }),
      React.createElement('input', { type: 'range', min: 0, max: 1, step: 0.01, value: volume, onChange: handleVolumeChange })
    ),
    streamInfo && React.createElement('div', { style: { marginTop: 8 } }, React.createElement('div', null, 'Content Type: ' + streamInfo.contentType))
  );
}

export function VideoPlayerDemo() {
  const sampleVideos = [
    { title: 'Big Buck Bunny', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
    { title: 'Elephant Dream', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' },
    { title: 'For Bigger Blazes', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' }
  ];

  const [currentIndex, setCurrentIndex] = React.useState(0);
  const current = sampleVideos[currentIndex];

  return React.createElement('div', null,
    React.createElement('h2', null, current.title),
    React.createElement(AdvancedVideoPlayer, { videoUrl: current.url }),
    React.createElement('div', { style: { marginTop: 8 } },
      React.createElement('button', { onClick: () => setCurrentIndex((i) => (i - 1 + sampleVideos.length) % sampleVideos.length) }, 'Previous'),
      React.createElement('span', { style: { margin: '0 8px' } }, `${currentIndex + 1} / ${sampleVideos.length}`),
      React.createElement('button', { onClick: () => setCurrentIndex((i) => (i + 1) % sampleVideos.length) }, 'Next')
    )
  );
}

// Mount demo when loaded
document.addEventListener('DOMContentLoaded', () => {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;
  const root = ReactDOM.createRoot(rootEl);
  root.render(React.createElement(VideoPlayerDemo));
});
