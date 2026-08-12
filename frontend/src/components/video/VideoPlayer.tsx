import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2,
  SkipBack, SkipForward, Gauge
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatTime } from '@/utils/time';

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  play: () => void;
  pause: () => void;
}

interface VideoPlayerProps {
  src?: string;
  /** Seek to this position (seconds) once video metadata is loaded */
  seekOnLoad?: number;
  onTimeUpdate?: (currentTime: number) => void;
  className?: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  ({ src, seekOnLoad, onTimeUpdate, className }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying]       = useState(false);
    const [muted, setMuted]           = useState(false);
    const [volume, setVolume]         = useState(1);
    const [current, setCurrent]       = useState(0);
    const [duration, setDuration]     = useState(0);
    const [fullscreen, setFullscreen] = useState(false);
    const [speed, setSpeed]           = useState(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [showControls, setShowControls]   = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const hideTimer    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // ── Expose handle ─────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      seekTo(seconds) {
        if (videoRef.current) {
          videoRef.current.currentTime = seconds;
        }
      },
      getCurrentTime() {
        return videoRef.current?.currentTime ?? 0;
      },
      play() {
        videoRef.current?.play().catch(() => {});
      },
      pause() {
        videoRef.current?.pause();
      },
    }));

    // ── Seek to seekOnLoad after metadata loads ───────────────────────────────
    const handleMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const vid = e.currentTarget;
      setDuration(vid.duration);
      if (seekOnLoad !== undefined && seekOnLoad > 0) {
        vid.currentTime = seekOnLoad;
        // Don't autoplay — just position the player
      }
    };

    // ── Auto-hide controls ────────────────────────────────────────────────────
    const resetHideTimer = () => {
      setShowControls(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    };

    useEffect(() => () => clearTimeout(hideTimer.current), []);

    const togglePlay = () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
      else          { v.pause(); setPlaying(false); }
    };

    const handleTimeUpdate = () => {
      const t = videoRef.current?.currentTime ?? 0;
      setCurrent(t);
      onTimeUpdate?.(t);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const t = Number(e.target.value);
      if (videoRef.current) videoRef.current.currentTime = t;
      setCurrent(t);
    };

    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setVolume(v);
      if (videoRef.current) videoRef.current.volume = v;
      setMuted(v === 0);
    };

    const toggleMute = () => {
      if (!videoRef.current) return;
      const next = !muted;
      setMuted(next);
      videoRef.current.muted = next;
    };

    const changeSpeed = (s: number) => {
      setSpeed(s);
      if (videoRef.current) videoRef.current.playbackRate = s;
      setShowSpeedMenu(false);
    };

    const toggleFullscreen = () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen();
        setFullscreen(true);
      } else {
        document.exitFullscreen();
        setFullscreen(false);
      }
    };

    return (
      <div
        ref={containerRef}
        className={cn('relative bg-black group', className)}
        onMouseMove={resetHideTimer}
        onMouseLeave={() => { if (playing) setShowControls(false); }}
        onClick={togglePlay}
      >
        {src ? (
          <video
            ref={videoRef}
            className="w-full h-full"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleMetadata}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            playsInline
          >
            <source src={src} type="video/mp4" />
            Your browser does not support HTML5 video.
          </video>
        ) : (
          // Placeholder when no src (mock mode / no backend)
          <div className="w-full aspect-video flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
            <div className="text-center">
              <Play size={48} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Video not available in demo mode</p>
              <p className="text-slate-600 text-xs mt-1">Start the Flask backend to serve videos</p>
            </div>
          </div>
        )}

        {/* ── Controls overlay ─────────────────────────────────────────────── */}
        {src && (
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 transition-opacity duration-300',
              showControls || !playing ? 'opacity-100' : 'opacity-0',
            )}
            onClick={e => e.stopPropagation()}
          >
            {/* Progress bar */}
            <div className="mb-2">
              <input
                type="range" min={0} max={duration || 0} value={current} step={0.5}
                onChange={handleSeek}
                className="w-full h-1 accent-brand-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-white/60 mt-0.5">
                <span>{formatTime(current)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Button row */}
            <div className="flex items-center gap-2">
              <button onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10; }} className="text-white/70 hover:text-white transition-colors" aria-label="Back 10s"><SkipBack size={16} /></button>
              <button onClick={togglePlay} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors" aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10; }} className="text-white/70 hover:text-white transition-colors" aria-label="Forward 10s"><SkipForward size={16} /></button>

              {/* Volume */}
              <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors" aria-label="Toggle mute">
                {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={handleVolume} className="w-16 h-1 accent-white cursor-pointer hidden sm:block" />

              <div className="flex-1" />

              {/* Speed */}
              <div className="relative">
                <button onClick={() => setShowSpeedMenu(s => !s)} className="flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium transition-colors" aria-label="Playback speed">
                  <Gauge size={14} /> {speed}x
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-8 right-0 bg-slate-900 border border-white/10 rounded-lg overflow-hidden shadow-xl z-10">
                    {SPEEDS.map(s => (
                      <button key={s} onClick={() => changeSpeed(s)} className={cn('block w-full text-left px-4 py-1.5 text-xs hover:bg-white/10 transition-colors', s === speed ? 'text-brand-400 font-semibold' : 'text-white/80')}>
                        {s}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors" aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          </div>
        )}

        {/* Center play flash */}
        {!playing && src && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Play size={28} className="text-white fill-white ml-1" />
            </div>
          </div>
        )}
      </div>
    );
  }
);
VideoPlayer.displayName = 'VideoPlayer';
