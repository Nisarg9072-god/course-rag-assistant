import { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, CheckCircle2, FileText,
  Sparkles, Play, RotateCcw, Link2, Check, MapPin,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageContainer } from '@/components/layout/PageContainer';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import type { VideoPlayerHandle } from '@/components/video/VideoPlayer';
import { Transcript } from '@/components/video/Transcript';
import { getVideo, getVideos } from '@/api/videos';
import { markLessonComplete, isLessonCompleted } from '@/utils/storage';
import { formatTime, padVideoNumber } from '@/utils/time';
import { cn } from '@/utils/cn';

type Tab = 'transcript' | 'ai';

export default function VideoPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const [params]     = useSearchParams();
  const navigate     = useNavigate();

  const id = Number(videoId ?? '0');

  // ── Query params ─────────────────────────────────────────────────────────────
  // Accept both ?start=N&end=M (new, canonical) and ?time=N (legacy)
  const startParam = params.get('start') ?? params.get('time');
  const endParam   = params.get('end');
  const startTime  = startParam ? Math.floor(Number(startParam)) : null;
  const endTime    = endParam   ? Math.ceil(Number(endParam))    : null;
  const hasSection = startTime !== null;

  // ── Data fetching ────────────────────────────────────────────────────────────
  const { data: video, isLoading, isError } = useQuery({
    queryKey: ['video', id],
    queryFn: () => getVideo(id),
    enabled: id > 0,
  });

  const { data: allVideos = [] } = useQuery({
    queryKey: ['videos'],
    queryFn: getVideos,
  });

  const prevVideo = allVideos.find(v => v.number === id - 1);
  const nextVideo = allVideos.find(v => v.number === id + 1);

  // ── Refs & state ─────────────────────────────────────────────────────────────
  const playerRef    = useRef<VideoPlayerHandle>(null);
  const [tab, setTab]             = useState<Tab>('transcript');
  const [completed, setCompleted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [copied, setCopied]       = useState(false);
  const [sectionActive, setSectionActive] = useState(false);  // true while playing section only

  useEffect(() => {
    setCompleted(isLessonCompleted(id));
  }, [id]);

  // ── Video source ─────────────────────────────────────────────────────────────
  // Prefer videoUrl from API response; fall back to constructing from number
  const videoSrc = video?.videoUrl
    ? video.videoUrl           // e.g. "/api/videos/18/stream" → proxied by Vite to :5000
    : undefined;               // shows placeholder in mock mode with no backend

  // ── Seek to startTime after metadata loads ───────────────────────────────────
  // This is handled inside VideoPlayer via the `seekOnLoad` prop below.

  // ── Section playback: stop at endTime ────────────────────────────────────────
  const handleTimeUpdate = useCallback((t: number) => {
    setCurrentTime(t);
    if (sectionActive && endTime !== null && t >= endTime) {
      playerRef.current?.pause();
      setSectionActive(false);
    }
  }, [sectionActive, endTime]);

  // ── "Play this section" ───────────────────────────────────────────────────────
  const handlePlaySection = () => {
    if (startTime === null) return;
    playerRef.current?.seekTo(startTime);
    setSectionActive(true);
  };

  // ── "Continue watching" ───────────────────────────────────────────────────────
  const handleContinue = () => {
    setSectionActive(false);
    playerRef.current?.play();
  };

  // ── Mark complete ─────────────────────────────────────────────────────────────
  const handleMarkComplete = () => {
    markLessonComplete(id);
    setCompleted(true);
  };

  // ── Share link ────────────────────────────────────────────────────────────────
  const shareUrl = (() => {
    const base = `${window.location.origin}/course/${id}`;
    if (startTime !== null) {
      const q = `?start=${startTime}${endTime !== null ? `&end=${endTime}` : ''}`;
      return `${base}${q}`;
    }
    return `${window.location.href}`;
  })();

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const el = document.createElement('textarea');
      el.value = shareUrl;
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── Loading / error states ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </PageContainer>
    );
  }

  if (isError || !video) {
    return (
      <PageContainer>
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <p className="text-slate-500 dark:text-slate-400">
            Video #{id} not found.{' '}
            <button onClick={() => navigate('/course')} className="text-brand-500 underline">
              Back to course
            </button>
          </p>
        </div>
      </PageContainer>
    );
  }

  const transcript = ((video as unknown as { transcript?: unknown[] }).transcript ?? []).map((c: unknown) => {
    const chunk = c as { start: number; end: number; text: string };
    return { number: video.number, title: video.title, start: chunk.start, end: chunk.end, text: chunk.text };
  });

  return (
    <PageContainer>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

        {/* ── Nav ──────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/course')}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            >
              <ChevronLeft size={16} /> Course
            </button>
            {prevVideo && (
              <>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <button
                  onClick={() => navigate(`/course/${prevVideo.number}`)}
                  className="text-sm text-slate-500 hover:text-brand-600 transition-colors"
                >
                  ← #{padVideoNumber(prevVideo.number)}
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {nextVideo && (
              <button
                onClick={() => navigate(`/course/${nextVideo.number}`)}
                className="text-sm text-slate-500 hover:text-brand-600 transition-colors"
              >
                #{padVideoNumber(nextVideo.number)} →
              </button>
            )}
            {completed && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 size={13} /> Done
              </span>
            )}
          </div>
        </div>

        {/* ── Title ────────────────────────────────────────────────────────── */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 leading-snug"
        >
          <span className="text-brand-500 font-mono text-base mr-2">
            #{padVideoNumber(video.number)}
          </span>
          {video.title}
        </motion.h1>

        {/* ── Shared-link banner ────────────────────────────────────────────── */}
        <AnimatePresence>
          {hasSection && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700/50"
            >
              <MapPin size={15} className="text-brand-500 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                  📍 Shared course moment — {video.title}
                </p>
                <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
                  Relevant section: {formatTime(startTime!)}
                  {endTime !== null && ` → ${formatTime(endTime)}`}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid lg:grid-cols-[1fr_340px] gap-5">
          {/* ── LEFT: player + controls ──────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Video player */}
            <div className="rounded-xl overflow-hidden bg-black shadow-xl shadow-black/30">
              <VideoPlayer
                ref={playerRef}
                src={videoSrc}
                seekOnLoad={startTime ?? undefined}
                onTimeUpdate={handleTimeUpdate}
                className="w-full aspect-video"
              />
            </div>

            {/* Relevant section info + controls */}
            {hasSection && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-[#18181f] rounded-xl border border-slate-200 dark:border-white/[0.06] p-4"
              >
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Relevant section
                </p>
                <p className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 mb-3">
                  {formatTime(startTime!)}
                  {endTime !== null && (
                    <span className="text-slate-400 dark:text-slate-500 font-normal"> → {formatTime(endTime)}</span>
                  )}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                  You're viewing the section related to your question.
                </p>

                <div className="flex flex-wrap gap-2">
                  {/* Play section */}
                  <button
                    onClick={handlePlaySection}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors"
                  >
                    <Play size={12} className="fill-white" />
                    Play this section
                  </button>

                  {/* Replay */}
                  <button
                    onClick={() => playerRef.current?.seekTo(startTime!)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] text-xs font-medium transition-colors"
                  >
                    <RotateCcw size={12} /> Replay
                  </button>

                  {/* Continue watching */}
                  <button
                    onClick={handleContinue}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] text-xs font-medium transition-colors"
                  >
                    <Play size={12} /> Continue watching
                  </button>

                  {/* Share */}
                  <button
                    onClick={handleShare}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                      copied
                        ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                        : 'border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]',
                    )}
                  >
                    {copied
                      ? <><Check size={12} /> Link copied!</>
                      : <><Link2 size={12} /> Share this moment</>
                    }
                  </button>
                </div>
              </motion.div>
            )}

            {/* Mark complete / Ask AI row */}
            <div className="flex items-center gap-3">
              {!completed && (
                <button
                  onClick={handleMarkComplete}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-300 hover:text-emerald-600 text-sm font-medium transition-all"
                >
                  <CheckCircle2 size={15} /> Mark complete
                </button>
              )}
              <button
                onClick={() => navigate(`/ask?q=Tell me more about: ${video.title}`)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-200 dark:border-brand-700/50 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 text-sm font-medium transition-all"
              >
                <Sparkles size={15} /> Ask AI about this lesson
              </button>
            </div>
          </div>

          {/* ── RIGHT: tabs ──────────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-[#18181f] rounded-xl border border-slate-200 dark:border-white/[0.06] flex flex-col min-h-0 overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-slate-100 dark:border-white/[0.06] shrink-0">
              {(['transcript', 'ai'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors',
                    tab === t
                      ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300',
                  )}
                >
                  {t === 'transcript' ? <><FileText size={13} /> Transcript</> : <><Sparkles size={13} /> Ask AI</>}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {tab === 'transcript' ? (
                transcript.length > 0 ? (
                  <Transcript
                    chunks={transcript}
                    currentTime={currentTime}
                    highlightStart={hasSection ? startTime! : undefined}
                    highlightEnd={hasSection && endTime !== null ? endTime : undefined}
                    onSeek={t => playerRef.current?.seekTo(t)}
                  />
                ) : (
                  <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-sm">
                    No transcript available for this video.
                  </div>
                )
              ) : (
                <div className="p-6 text-center">
                  <Sparkles size={24} className="text-brand-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Ask about this lesson
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                    Get AI explanations for anything in this video
                  </p>
                  <button
                    onClick={() => navigate(`/ask?q=Explain what is covered in: ${video.title}`)}
                    className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors"
                  >
                    <Sparkles size={13} /> Open AI Chat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
