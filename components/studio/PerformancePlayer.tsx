'use client';

import { useEffect, useRef, useState } from 'react';
import { PlayCircle } from '@phosphor-icons/react';
import type { Performance } from '@/lib/studio/demo';

export type PerformanceControl = { play(): void; pause(): void; time(): number; volume(value: number): void };
type Player = { playVideo(): void; pauseVideo(): void; getCurrentTime(): number; setVolume(value: number): void; destroy(): void };
type PlayerWindow = Window & {
  YT?: { Player: new (target: HTMLElement, config: Record<string, unknown>) => Player };
  onYouTubeIframeAPIReady?: () => void;
};

let apiPromise: Promise<void> | undefined;

function loadPlayerAPI() {
  const playerWindow = window as PlayerWindow;
  if (playerWindow.YT?.Player) return Promise.resolve();
  if (!apiPromise) apiPromise = new Promise<void>((resolve, reject) => {
    const previous = playerWindow.onYouTubeIframeAPIReady;
    playerWindow.onYouTubeIframeAPIReady = () => { previous?.(); resolve(); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => { apiPromise = undefined; reject(new Error('The video player could not load.')); };
    document.head.append(script);
  });
  return apiPromise;
}

export default function PerformancePlayer({ performance, onControl, onPlaying, onExternalOpen }: {
  performance: Performance;
  onControl: (control: PerformanceControl | null) => void;
  onPlaying: (playing: boolean) => void;
  onExternalOpen: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const callbacks = useRef({ onControl, onPlaying });
  callbacks.current = { onControl, onPlaying };

  useEffect(() => {
    let cancelled = false;
    let player: Player | undefined;
    setError('');
    setReady(false);
    const timeout = setTimeout(() => {
      if (!cancelled) {
        callbacks.current.onControl(null);
        setError('Open the official performance in another tab, then share that tab’s audio to listen.');
      }
    }, 8000);
    const host = root.current;
    if (!host) return;
    // Keep the official embed compatible with the studio's threaded audio runtime.
    const target = document.createElement('iframe');
    target.setAttribute('credentialless', '');
    target.title = performance.artist + ' official freestyle performance';
    target.width = '100%'; target.height = '200';
    target.allow = 'autoplay; encrypted-media; picture-in-picture';
    target.allowFullscreen = true;
    const params = new URLSearchParams({ enablejsapi: '1', playsinline: '1', rel: '0', origin: window.location.origin });
    target.src = 'https://www.youtube.com/embed/' + performance.id + '?' + params;
    host.replaceChildren(target);
    loadPlayerAPI().then(() => {
      if (cancelled || !(window as PlayerWindow).YT) return;
      player = new (window as PlayerWindow).YT!.Player(target, {
        events: {
          onReady: () => {
            if (!player || cancelled) return;
            clearTimeout(timeout);
            setReady(true); setError('');
            const active = player;
            callbacks.current.onControl({ play: () => active.playVideo(), pause: () => active.pauseVideo(), time: () => active.getCurrentTime() || 0, volume: value => active.setVolume(value * 100) });
          },
          onStateChange: (event: { data: number }) => callbacks.current.onPlaying(event.data === 1),
          onError: () => {
            clearTimeout(timeout);
            setReady(false);
            callbacks.current.onControl(null);
            callbacks.current.onPlaying(false);
            setError('This performance cannot play here. Open the official video in another tab and share that tab’s audio.');
          }
        }
      });
    }).catch(() => { clearTimeout(timeout); if (!cancelled) setError('The video player could not load. Open the official video in another tab to listen.'); });
    return () => { cancelled = true; clearTimeout(timeout); callbacks.current.onControl(null); callbacks.current.onPlaying(false); player?.destroy(); };
  }, [performance.id, performance.artist]);

  return <div className="studio-video-wrap">
    <div ref={root} className="studio-video" style={{ display: ready && !error ? 'block' : 'none' }} />
    {(!ready || error) && <a className="studio-video-fallback" href={performance.url} target="_blank" rel="noreferrer" onClick={onExternalOpen}>
      {/* The official thumbnail remains useful when an embedded player is unavailable. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={'https://i.ytimg.com/vi/' + performance.id + '/hqdefault.jpg'} alt={performance.artist + ' official freestyle performance'} />
      <span><PlayCircle size={38} weight="fill" /><strong>Play official performance</strong></span>
    </a>}
    {error && <p className="studio-player-error" role="status">{error}</p>}
    <a href={performance.url} target="_blank" rel="noreferrer" className="studio-source-link" onClick={onExternalOpen}>{performance.venue} · Official performance ↗</a>
  </div>;
}
