import { useRef, useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle2, FileText, Sparkles } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import type { VideoPlayerHandle } from '@/components/video/VideoPlayer';
import { Transcript } from '@/components/video/Transcript';
import { getVideo, getVideos } from '@/api/videos';
import { markLessonComplete, isLessonCompleted } from '@/utils/storage';
import { formatTime, padVideoNumber } from '@/utils/time';
import { USE_MOCK } from '@/api/client';

export default function VideoPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const playerRef = useRef<VideoPlayerHandle>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [tab, setTab] = useState<'transcript' | 'ai'>('transcript');

  const id = Number(videoId);
  const seekTime = Number(params.get('time') ?? '0');

  const { data: video, isLoading, error } = useQuery({
    queryKey: ['video', id],
    queryFn: () => getVideo(id),
    enabled: !isNaN(id),
  });

  const { data: allVideos = [] } = useQuery({
    queryKey: ['videos'],
    queryFn: getVideos,
  });

  const prevVideo = allVideos.find(v => v.number === id - 1);
  const nextVideo = allVideos.find(v => v.number === id + 1);
  const completed = isLessonCompleted(id);

  // Seek to timestamp once video is loaded
  useEffect(() => {
    if (!video || seekTime <= 0) return;
    const timer = setTimeout(() => {
      playerRef.current?.seekTo(seekTime);
    }, 500);
    return () => clearTimeout(timer);
  }, [video, seekTime]);

  const videoSrc = USE_MOCK
    ? undefined
    : `${import.meta.env.VITE_API_URL}/videos/${video?.videoFile ?? ''}`;

  if (isLoading) {
    return (
      <PageContainer>
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
          <div className="aspect-video rounded-xl bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
          <div className="h-6 w-64 bg-slate-100 dark:bg-white/[0.04] rounded animate-pulse" />
          <div className="h-4 w-40 bg-slate-100 dark:bg-white/[0.04] rounded animate-pulse" />
        </div>
      </PageContainer>
    );
  }

  if (error || !video) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-10">
            <p className="text-slate-500 dark:text-slate-400 text-sm">Video not found.</p>
            <button onClick={() => navigate('/course')} className="mt-4 text-sm text-brand-500 hover:underline">← Back to Course</button>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="lg:grid lg:grid-cols-5 lg:gap-6">

          {/* ── Player column ──────────────────────────────────────────────── */}
          <div className="lg:col-span-3">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-4 text-xs text-slate-400 dark:text-slate-500">
              <button onClick={() => navigate('/course')} className="hover:text-brand-500 transition-colors">Course</button>
              <span>/</span>
              <span className="text-slate-600 dark:text-slate-300">#{padVideoNumber(video.number)} {video.title}</span>
            </div>

            {/* Video */}
            <div className="rounded-xl overflow-hidden shadow-xl shadow-black/10 dark:shadow-black/30">
              <VideoPlayer
                ref={playerRef}
                src={videoSrc}
                onTimeUpdate={setCurrentTime}
                className="aspect-video w-full"
              />
            </div>

            {/* Video info */}
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  <span className="text-brand-500 mr-2">#{padVideoNumber(video.number)}</span>
                  {video.title}
                </h1>
                {seekTime > 0 && (
                  <p className="text-sm text-brand-500 dark:text-brand-400 mt-1 flex items-center gap-1.5">
                    ▶ Started at {formatTime(seekTime)}
                  </p>
                )}
              </div>

              {/* Mark complete */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { markLessonComplete(id); window.location.reload(); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                  completed
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/50'
                    : 'bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600'
                }`}
              >
                <CheckCircle2 size={14} />
                {completed ? 'Completed' : 'Mark complete'}
              </motion.button>
            </div>

            {/* Prev / Next navigation */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => prevVideo && navigate(`/course/${prevVideo.number}`)}
                disabled={!prevVideo}
                className="flex items-center gap-1.5 flex-1 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-white/[0.06] text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
                <div className="text-left min-w-0">
                  <p className="text-[10px] text-slate-400">Previous</p>
                  <p className="text-xs font-medium truncate">{prevVideo?.title ?? 'No previous'}</p>
                </div>
              </button>
              <button
                onClick={() => nextVideo && navigate(`/course/${nextVideo.number}`)}
                disabled={!nextVideo}
                className="flex items-center gap-1.5 flex-1 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-white/[0.06] text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-all justify-end"
              >
                <div className="text-right min-w-0">
                  <p className="text-[10px] text-slate-400">Next</p>
                  <p className="text-xs font-medium truncate">{nextVideo?.title ?? 'No next'}</p>
                </div>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* ── Sidebar ────────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 mt-6 lg:mt-0">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/[0.06] mb-0">
              {[
                { key: 'transcript', label: 'Transcript', icon: FileText },
                { key: 'ai',         label: 'Ask AI',     icon: Sparkles  },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key as 'transcript' | 'ai')}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                    tab === key
                      ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                      : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            {tab === 'transcript' ? (
              <div className="max-h-[60vh] overflow-y-auto rounded-b-xl border-x border-b border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#18181f]">
                <Transcript
                  chunks={video.transcript || []}
                  currentTime={currentTime}
                  onSeek={t => playerRef.current?.seekTo(t)}
                />
              </div>
            ) : (
              <div className="p-4 border-x border-b border-slate-200 dark:border-white/[0.06] rounded-b-xl bg-white dark:bg-[#18181f] text-center">
                <Sparkles size={24} className="text-brand-500 mx-auto mb-3" />
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">Ask a question about this lesson</p>
                <button
                  onClick={() => navigate(`/ask?q=Explain ${video.title}`)}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Ask about this lesson
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
