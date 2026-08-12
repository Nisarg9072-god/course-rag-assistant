import { useQuery } from '@tanstack/react-query';
import { BookOpen, Clock, Layers, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageContainer } from '@/components/layout/PageContainer';
import { LessonCard } from '@/components/course/LessonCard';
import { getVideos, getStats } from '@/api/videos';
import { getCompletedCount } from '@/utils/storage';
import { formatDuration } from '@/utils/time';
import type { CourseVideo } from '@/types';

function hasProcessingVideos(videos: CourseVideo[]): boolean {
  return videos.some(v => {
    if (v.status === 'processing' || v.status === 'queued') return true;
    const jobStatus = v.job?.status;
    return jobStatus === 'queued' || jobStatus === 'processing';
  });
}

export default function Course() {
  const { data: videos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['videos'],
    queryFn: getVideos,
    refetchInterval: (query) => {
      const list = query.state.data ?? [];
      return hasProcessingVideos(list) ? 4000 : false;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    refetchInterval: hasProcessingVideos(videos) ? 4000 : false,
  });

  const completedCount = getCompletedCount();
  const total = videos.length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <PageContainer>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
            Sigma Web Development Course
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            HTML · CSS · JavaScript — from beginner to advanced
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <BookOpen size={15} /> {total} Lessons
            </span>
            {stats && (
              <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                <Clock size={15} /> {formatDuration(stats.totalDurationSeconds)}
              </span>
            )}
            {stats && (
              <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                <Layers size={15} /> {stats.totalChunks.toLocaleString()} transcript segments
              </span>
            )}
            <span className="flex items-center gap-1.5 text-sm text-emerald-500">
              <CheckCircle2 size={15} /> {completedCount} completed
            </span>
          </div>

          {/* Progress */}
          {total > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mb-1.5">
                <span>Your Progress</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                  className="h-full bg-gradient-to-r from-brand-500 to-purple-500 rounded-full"
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* Lesson list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-3">Unable to load videos.</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {videos.map((video, i) => (
              <LessonCard key={video.number} video={video} index={i} />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
