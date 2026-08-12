import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, Circle, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import {
  getProcessingJobs,
  getProcessingJob,
  retryProcessing,
  PROCESSING_STAGES,
  stageLabel,
} from '@/api/admin';
import { cn } from '@/utils/cn';

function JobCard({
  jobId,
  superseded,
  onRetrySuccess,
}: {
  jobId: string;
  superseded: boolean;
  onRetrySuccess: (oldId: string, newId: string) => void;
}) {
  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getProcessingJob(jobId),
    enabled: !superseded,
    refetchInterval: (q) => {
      if (superseded) return false;
      const s = q.state.data?.status;
      return s === 'completed' || s === 'failed' ? false : 2000;
    },
  });

  if (superseded || !job) return null;

  const stageList = [...PROCESSING_STAGES];
  const currentIdx = stageList.indexOf(job.stage as typeof PROCESSING_STAGES[number]);

  const handleRetry = async () => {
    const result = await retryProcessing(jobId);
    onRetrySuccess(jobId, result.jobId || result.job_id);
  };

  return (
    <div className="p-5 rounded-xl bg-white dark:bg-[#18181f] border border-slate-200 dark:border-white/[0.06]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {job.videoTitle ?? `Video #${job.videoId}`}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {stageLabel(job.stage)}
            {job.progress > 0 && job.progress < 100 ? ` · ${job.progress}%` : ''}
          </p>
        </div>
        {job.status === 'failed' && (
          <button
            onClick={handleRetry}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium"
          >
            <RefreshCw size={12} /> Retry
          </button>
        )}
      </div>

      {job.status === 'processing' && job.progress > 0 && job.progress < 100 && (
        <div className="mb-4 h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 transition-all duration-300"
            style={{ width: `${job.progress}%` }}
          />
        </div>
      )}

      {job.status === 'failed' && job.errorMessage && (
        <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-xs">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          {job.errorMessage}
        </div>
      )}

      <ul className="space-y-2">
        {stageList.map((stage, idx) => {
          const done = job.status === 'completed' || (currentIdx >= 0 && idx < currentIdx);
          const active = idx === currentIdx && job.status === 'processing';
          const failed = job.status === 'failed' && idx === currentIdx;

          return (
            <li key={stage} className="flex items-center gap-2 text-xs">
              {done ? (
                <Check size={14} className="text-emerald-500 shrink-0" />
              ) : active ? (
                <Loader2 size={14} className="text-brand-500 animate-spin shrink-0" />
              ) : failed ? (
                <AlertCircle size={14} className="text-red-500 shrink-0" />
              ) : (
                <Circle size={14} className="text-slate-300 shrink-0" />
              )}
              <span className={cn(
                done && 'text-emerald-600',
                active && 'text-brand-600 font-medium',
                failed && 'text-red-500',
                !done && !active && !failed && 'text-slate-400',
              )}>
                {stageLabel(stage)}
              </span>
            </li>
          );
        })}
      </ul>

      {job.status === 'completed' && (
        <p className="mt-4 text-sm text-emerald-600 font-medium">
          ✓ Video ready — searchable by AI
        </p>
      )}
    </div>
  );
}

export default function AdminJobs() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const highlightJob = params.get('job');
  const [activeJobId, setActiveJobId] = useState<string | null>(highlightJob);
  const [supersededJobIds, setSupersededJobIds] = useState<Set<string>>(new Set());

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: getProcessingJobs,
    refetchInterval: (q) => {
      const list = q.state.data ?? [];
      const active = list.some(j => j.status === 'queued' || j.status === 'processing');
      return active ? 4000 : false;
    },
  });

  useEffect(() => {
    if (highlightJob) setActiveJobId(highlightJob);
  }, [highlightJob]);

  useEffect(() => {
    if (activeJobId) {
      document.getElementById(`job-${activeJobId}`)?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeJobId, jobs]);

  const handleRetrySuccess = (oldId: string, newId: string) => {
    setSupersededJobIds(prev => new Set([...prev, oldId]));
    setActiveJobId(newId);
    setParams({ job: newId });
    queryClient.removeQueries({ queryKey: ['job', oldId] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['job', newId] });
    queryClient.invalidateQueries({ queryKey: ['videos'] });
  };

  const latestByVideo = new Map<number, string>();
  for (const job of jobs) {
    if (job.videoId != null) latestByVideo.set(job.videoId, job.id);
  }

  const displayJobs = (() => {
    const ids = new Set<string>();
    if (activeJobId) ids.add(activeJobId);
    for (const job of jobs) {
      if (supersededJobIds.has(job.id)) continue;
      if (job.videoId != null && latestByVideo.get(job.videoId) !== job.id) continue;
      ids.add(job.id);
    }
    const ordered = activeJobId ? [activeJobId, ...[...ids].filter(id => id !== activeJobId)] : [...ids];
    return ordered;
  })();

  return (
    <PageContainer>
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6"
        >
          Processing Jobs
        </motion.h1>

        <div className="space-y-4">
          {displayJobs.length === 0 ? (
            <p className="text-sm text-slate-500">No processing jobs yet.</p>
          ) : (
            displayJobs.map(id => (
              <div key={id} id={`job-${id}`}>
                <JobCard
                  jobId={id}
                  superseded={supersededJobIds.has(id)}
                  onRetrySuccess={handleRetrySuccess}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </PageContainer>
  );
}
