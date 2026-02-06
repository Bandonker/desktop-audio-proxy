/**
 * React Video Player Component using Desktop Audio Proxy
 * 
 * This example demonstrates how to build a video player that:
 * - Bypasses CORS restrictions
 * - Supports MP4, WebM, M3U8/HLS
 * - Handles seeking with range requests
 * - Shows loading states and error handling
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAudioUrl } from 'desktop-audio-proxy/react';

/**
 * Basic Video Player Component
 */
export function BasicVideoPlayer({ videoUrl }) {
  const { playableUrl, loading, error } = useAudioUrl(videoUrl, {
    autoStartProxy: true,
    fallbackToOriginal: true
  });

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading video...</div>
        <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          Starting proxy server if needed
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <strong>Error loading video:</strong>
        <div>{error.message}</div>
      </div>
    );
  }

  return (
    <video
      src={playableUrl}
      controls
      style={{ width: '100%', maxWidth: '800px' }}
    >
      Your browser does not support the video tag.
    </video>
  );
}

/**
 * Advanced Video Player with Controls and Metadata
 */
export function AdvancedVideoPlayer({ videoUrl }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const { playableUrl, loading, error, streamInfo } = useAudioUrl(videoUrl, {
    autoStartProxy: true,
    retryAttempts: 3,
    retryDelay: 1000
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
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
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loader}>
          <div style={styles.spinner} />
          <div>Loading video...</div>
          {streamInfo && (
            <div style={styles.info}>
              Checking stream: {streamInfo.contentType}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h3>⚠️ Error Loading Video</h3>
          <p>{error.message}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.videoWrapper}>
        <video
          ref={videoRef}
          src={playableUrl}
          style={styles.video}
        >
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Custom Controls */}
      <div style={styles.controls}>
        <button onClick={togglePlayPause} style={styles.button}>
          {isPlaying ? '⏸️ Pause' : '▶️ Play'}
        </button>

        <div style={styles.timeDisplay}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          style={styles.seekBar}
        />

        <div style={styles.volumeControl}>
          <span>🔊</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            style={styles.volumeSlider}
          />
        </div>
      </div>

      {/* Video Metadata */}
      {streamInfo && (
        <div style={styles.metadata}>
          <div><strong>Content Type:</strong> {streamInfo.contentType}</div>
          <div><strong>Size:</strong> {streamInfo.contentLength ? `${(parseInt(streamInfo.contentLength) / 1024 / 1024).toFixed(2)} MB` : 'Unknown'}</div>
          <div><strong>Supports Seeking:</strong> {streamInfo.acceptRanges === 'bytes' ? '✅ Yes' : '❌ No'}</div>
          <div><strong>Via Proxy:</strong> {streamInfo.requiresProxy ? '✅ Yes' : '❌ Direct'}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Multi-Video Playlist Player
 */
export function VideoPlaylist({ videos }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentVideo = videos[currentIndex];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % videos.length);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
  };

  return (
    <div style={styles.playlistContainer}>
      <h2>{currentVideo.title}</h2>
      
      <AdvancedVideoPlayer videoUrl={currentVideo.url} />

      <div style={styles.playlistControls}>
        <button onClick={handlePrevious} style={styles.button}>
          ⏮️ Previous
        </button>
        <span style={styles.playlistInfo}>
          {currentIndex + 1} / {videos.length}
        </span>
        <button onClick={handleNext} style={styles.button}>
          ⏭️ Next
        </button>
      </div>

      {/* Playlist */}
      <div style={styles.playlistItems}>
        {videos.map((video, index) => (
          <div
            key={index}
            onClick={() => setCurrentIndex(index)}
            style={{
              ...styles.playlistItem,
              ...(index === currentIndex ? styles.playlistItemActive : {})
            }}
          >
            <div style={styles.playlistItemNumber}>{index + 1}</div>
            <div style={styles.playlistItemTitle}>{video.title}</div>
            {index === currentIndex && <span>▶️</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Styles
const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  videoWrapper: {
    position: 'relative',
    backgroundColor: '#000',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  video: {
    width: '100%',
    height: 'auto',
    display: 'block'
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    marginTop: '12px'
  },
  button: {
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  timeDisplay: {
    fontSize: '14px',
    fontWeight: '500',
    minWidth: '100px'
  },
  seekBar: {
    flex: 1,
    height: '4px',
    cursor: 'pointer'
  },
  volumeControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  volumeSlider: {
    width: '80px',
    cursor: 'pointer'
  },
  metadata: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    fontSize: '14px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '8px'
  },
  loader: {
    textAlign: 'center',
    padding: '40px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    margin: '0 auto 16px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #007bff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  info: {
    fontSize: '12px',
    color: '#666',
    marginTop: '8px'
  },
  error: {
    padding: '40px',
    textAlign: 'center',
    color: '#d32f2f'
  },
  playlistContainer: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '20px'
  },
  playlistControls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    marginTop: '16px'
  },
  playlistInfo: {
    fontSize: '14px',
    fontWeight: '500'
  },
  playlistItems: {
    marginTop: '24px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  playlistItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #eee',
    transition: 'background-color 0.2s'
  },
  playlistItemActive: {
    backgroundColor: '#e3f2fd',
    fontWeight: '600'
  },
  playlistItemNumber: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007bff',
    color: 'white',
    borderRadius: '50%',
    fontSize: '14px',
    fontWeight: '600'
  },
  playlistItemTitle: {
    flex: 1
  }
};

// Usage Example
export function VideoPlayerDemo() {
  const sampleVideos = [
    {
      title: 'Big Buck Bunny',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    },
    {
      title: 'Elephant Dream',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
    },
    {
      title: 'For Bigger Blazes',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
    }
  ];

  return (
    <div>
      <h1 style={{ textAlign: 'center', marginBottom: '32px' }}>
        Video Player with CORS Bypass
      </h1>
      
      {/* Basic Example */}
      <section style={{ marginBottom: '48px' }}>
        <h2>Basic Player</h2>
        <BasicVideoPlayer videoUrl={sampleVideos[0].url} />
      </section>

      {/* Advanced Example */}
      <section style={{ marginBottom: '48px' }}>
        <h2>Advanced Player with Custom Controls</h2>
        <AdvancedVideoPlayer videoUrl={sampleVideos[1].url} />
      </section>

      {/* Playlist Example */}
      <section>
        <h2>Video Playlist</h2>
        <VideoPlaylist videos={sampleVideos} />
      </section>
    </div>
  );
}
