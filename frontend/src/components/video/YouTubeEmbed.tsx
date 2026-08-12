import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState,
} from 'react';
import type { VideoPlayerHandle } from '@/components/video/VideoPlayer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const YT: any;

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

interface YouTubePlayerProps {
  videoId: string;
  seekOnLoad?: number;
  /** When set (section playback active), pause at this time. */
  sectionEndTime?: number | null;
  onTimeUpdate?: (currentTime: number) => void;
  className?: string;
}

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise(resolve => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  });
  return ytApiPromise;
}

export const YouTubeEmbed = forwardRef<VideoPlayerHandle, YouTubePlayerProps>(
  ({ videoId, seekOnLoad, sectionEndTime, onTimeUpdate, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YTPlayer | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const sectionEndRef = useRef(sectionEndTime);
    const [ready, setReady] = useState(false);

    sectionEndRef.current = sectionEndTime;

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        playerRef.current?.seekTo(seconds, true);
        onTimeUpdate?.(seconds);
      },
      getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
      play: () => playerRef.current?.playVideo(),
      pause: () => playerRef.current?.pauseVideo(),
    }));

    const clearInterval_ = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const startTimePolling = () => {
      clearInterval_();
      intervalRef.current = setInterval(() => {
        const t = playerRef.current?.getCurrentTime() ?? 0;
        onTimeUpdate?.(t);
        const end = sectionEndRef.current;
        if (end != null && t >= end) {
          playerRef.current?.pauseVideo();
        }
      }, 300);
    };

    useEffect(() => {
      let cancelled = false;

      loadYouTubeApi().then(() => {
        if (cancelled || !containerRef.current) return;

        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: () => {
              setReady(true);
              if (seekOnLoad != null && seekOnLoad > 0) {
                playerRef.current?.seekTo(seekOnLoad, true);
                onTimeUpdate?.(seekOnLoad);
              }
              startTimePolling();
            },
            onStateChange: (e: { data: number }) => {
              // YT.PlayerState.PLAYING = 1, PAUSED = 2, ENDED = 0
              if (e.data === 1 || e.data === 2) {
                startTimePolling();
              } else if (e.data === 0) {
                clearInterval_();
              }
            },
          },
        }) as unknown as YTPlayer;
      });

      return () => {
        cancelled = true;
        clearInterval_();
        playerRef.current?.destroy();
        playerRef.current = null;
      };
    }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (ready && seekOnLoad != null && seekOnLoad > 0) {
        playerRef.current?.seekTo(seekOnLoad, true);
        onTimeUpdate?.(seekOnLoad);
      }
    }, [ready, seekOnLoad, onTimeUpdate]);

    return (
      <div className={className}>
        <div ref={containerRef} className="w-full aspect-video" />
      </div>
    );
  },
);

YouTubeEmbed.displayName = 'YouTubeEmbed';
