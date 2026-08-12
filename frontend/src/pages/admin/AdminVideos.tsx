import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Play, Trash2, RefreshCw, Clock, Layers, Loader2, CheckCircle2, AlertCircle,
  FileText, Settings2,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { getVideos } from '@/api/videos';
import { deleteVideo, reprocessVideo, stageLabel } from '@/api/admin';
import { formatDuration, padVideoNumber } from '@/utils/time';
import { cn } from '@/utils/cn';

import type { CourseVideo } from '@/types';

function hasProcessingVideos(videos: CourseVideo[]): boolean {
  return videos.some(v => {
    if (v.status === 'processing' || v.status === 'queued') return true;
    const jobStatus = v.job?.status;
    return jobStatus === 'queued' || jobStatus === 'processing';
  });
}

export default function AdminVideos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['videos'],
    queryFn: getVideos,
    refetchInterval: (query) => {
      const list = query.state.data ?? [];
      return hasProcessingVideos(list) ? 4000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      setConfirmDelete(null);
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: reprocessVideo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['videos'] }),
  });

  const statusIcon = (status?: string) => {
    if (status === 'ready') return <CheckCircle2 size={14} className="text-emerald-500" />;
    if (status === 'failed') return <AlertCircle size={14} className="text-red-500" />;
    if (status === 'processing' || status === 'queued') {
      return <Loader2 size={14} className="text-amber-500 animate-spin" />;
    }
    return null;
  };

  return (
    <PageContainer>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Manage Videos</h1>
          <button
            onClick={() => navigate('/admin/videos/add')}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold"
          >
            + Add Video
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {videos.map((video, i) => (
              <motion.div
                key={video.number}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="p-5 rounded-xl bg-white dark:bg-[#18181f] border border-slate-200 dark:border-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono text-brand-500 mb-1">#{padVideoNumber(video.number)}</p>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{video.title}</h2>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                      <span>Source: {video.sourceType === 'youtube' ? 'YouTube' : 'Local Upload'}</span>
                      {video.duration > 0 && (
                        <span className="flex items-center gap-1"><Clock size={11} /> {formatDuration(video.duration)}</span>
                      )}
                      <span className="flex items-center gap-1"><Layers size={11} /> {video.chunkCount} chunks</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 text-xs font-medium">
                      {statusIcon(video.status)}
                      <span className={cn(
                        video.status === 'ready' && 'text-emerald-600',
                        video.status === 'failed' && 'text-red-500',
                        (video.status === 'processing' || video.status === 'queued') && 'text-amber-600',
                      )}>
                        {video.status === 'ready'
                          ? 'Ready ✓'
                          : video.processingStage
                            ? `${stageLabel(video.processingStage)}…`
                            : stageLabel(video.status ?? 'queued')}
                      </span>
                      {video.job && video.job.progress > 0 && video.job.progress < 100 && (
                        <span className="text-slate-400">{video.job.progress}%</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    {video.status === 'ready' && (
                      <button
                        onClick={() => navigate(`/course/${video.number}`)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-slate-50"
                      >
                        <Play size={12} /> Watch
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/admin/videos/${video.number}`)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-slate-50"
                    >
                      <Settings2 size={12} /> Manage
                    </button>
                    <button
                      onClick={() => navigate(`/admin/videos/${video.number}`)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-slate-50"
                    >
                      <FileText size={12} /> Transcript
                    </button>
                    <button
                      onClick={() => reprocessMutation.mutate(video.number)}
                      disabled={reprocessMutation.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-slate-50"
                    >
                      <RefreshCw size={12} /> Reprocess
                    </button>
                    {confirmDelete === video.number ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => deleteMutation.mutate(video.number)}
                          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-3 py-1.5 rounded-lg border text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(video.number)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
