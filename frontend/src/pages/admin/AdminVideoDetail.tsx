import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Play, RefreshCw, Trash2 } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Transcript } from '@/components/video/Transcript';
import { getVideo } from '@/api/videos';
import { deleteVideo, reprocessVideo, stageLabel } from '@/api/admin';
import { formatDuration, padVideoNumber } from '@/utils/time';

export default function AdminVideoDetail() {
  const { videoId } = useParams<{ videoId: string }>();
  const id = Number(videoId ?? '0');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: video, isLoading } = useQuery({
    queryKey: ['video', id],
    queryFn: () => getVideo(id),
    enabled: id > 0,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'processing' || s === 'queued' ? 3000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteVideo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      navigate('/admin/videos');
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: () => reprocessVideo(id),
    onSuccess: (data) => navigate(`/admin/jobs?job=${data.job_id}`),
  });

  if (isLoading || !video) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </PageContainer>
    );
  }

  const transcript = (video.transcript ?? []).map(c => ({
    number: video.number,
    title: video.title,
    start: c.start,
    end: c.end,
    text: c.text,
  }));

  return (
    <PageContainer>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => navigate('/admin/videos')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 mb-6"
        >
          <ArrowLeft size={16} /> Back to videos
        </button>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-mono text-brand-500">#{padVideoNumber(video.number)}</p>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{video.title}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Status: {video.status ?? 'ready'}
              {video.processingStage && ` · ${stageLabel(video.processingStage)}`}
              {video.job?.progress != null && video.job.progress > 0 && video.job.progress < 100
                && ` · ${video.job.progress}%`}
              {video.duration > 0 && ` · ${formatDuration(video.duration)}`}
              {` · ${video.chunkCount} chunks`}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {video.status === 'ready' && (
              <button
                onClick={() => navigate(`/course/${id}`)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium"
              >
                <Play size={12} /> Watch
              </button>
            )}
            <button
              onClick={() => reprocessMutation.mutate()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium"
            >
              <RefreshCw size={12} /> Reprocess
            </button>
            <button
              onClick={() => { if (confirm('Delete this video permanently?')) deleteMutation.mutate(); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>

        {video.job?.errorMessage && (
          <div className="p-3 mb-4 rounded-lg bg-red-50 text-red-600 text-sm">
            ✕ {stageLabel(video.job.stage)} failed — {video.job.errorMessage}
          </div>
        )}

        {(video.status === 'processing' || video.status === 'queued') && video.job && (
          <div className="mb-4">
            <p className="text-sm font-medium text-amber-600 mb-2">
              {stageLabel(video.processingStage ?? video.job.stage)}…
            </p>
            {video.job.progress > 0 && video.job.progress < 100 && (
              <div className="h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{ width: `${video.job.progress}%` }}
                />
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#18181f] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
            <h2 className="text-sm font-semibold">Transcript</h2>
            <p className="text-xs text-slate-500">{transcript.length} segments</p>
          </div>
          {transcript.length > 0 ? (
            <div className="max-h-[480px] overflow-y-auto">
              <Transcript chunks={transcript} currentTime={0} onSeek={() => {}} />
            </div>
          ) : (
            <p className="p-6 text-sm text-slate-400 text-center">No transcript yet.</p>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
