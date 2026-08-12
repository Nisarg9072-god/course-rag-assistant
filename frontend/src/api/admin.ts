import type {
  AdminStats,
  ProcessingJob,
  UploadVideoResponse,
} from '@/types';
import { apiFetch, USE_MOCK } from './client';
import { getAdminToken } from './auth';

export async function uploadVideo(
  file: File,
  title: string,
  number: number,
): Promise<UploadVideoResponse> {
  if (USE_MOCK) {
    return {
      video_id: String(number),
      videoId: number,
      job_id: 'mock-job',
      status: 'queued',
    };
  }
  const form = new FormData();
  form.append('file', file);
  form.append('title', title);
  form.append('number', String(number));

  const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const token = getAdminToken();
  const res = await fetch(`${BASE_URL}/api/videos/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  return res.json() as Promise<UploadVideoResponse>;
}

export async function addVideoSource(
  url: string,
  title: string,
  number: number,
): Promise<UploadVideoResponse> {
  if (USE_MOCK) {
    return {
      video_id: String(number),
      videoId: number,
      job_id: 'mock-job',
      status: 'queued',
    };
  }
  return apiFetch<UploadVideoResponse>('/api/videos/source', {
    method: 'POST',
    body: JSON.stringify({ url, title, number }),
  });
}

export async function getProcessingJob(jobId: string): Promise<ProcessingJob> {
  if (USE_MOCK) {
    return {
      id: jobId,
      status: 'completed',
      stage: 'completed',
      progress: 100,
    };
  }
  return apiFetch<ProcessingJob>(`/api/jobs/${jobId}`);
}

export async function getProcessingJobs(): Promise<ProcessingJob[]> {
  if (USE_MOCK) return [];
  return apiFetch<ProcessingJob[]>('/api/jobs');
}

export async function retryProcessing(jobId: string): Promise<{
  success: boolean;
  job_id: string;
  jobId: string;
  videoId?: number;
  status: string;
}> {
  if (USE_MOCK) return { success: true, job_id: 'mock-retry', jobId: 'mock-retry', status: 'queued' };
  return apiFetch(`/api/jobs/${jobId}/retry`, { method: 'POST' });
}

export async function deleteVideo(id: number): Promise<void> {
  if (USE_MOCK) return;
  await apiFetch(`/api/videos/${id}`, { method: 'DELETE' });
}

export async function reprocessVideo(id: number): Promise<{ job_id: string; status: string }> {
  if (USE_MOCK) return { job_id: 'mock-reprocess', status: 'queued' };
  return apiFetch<{ job_id: string; status: string }>(`/api/videos/${id}/reprocess`, { method: 'POST' });
}

export async function getAdminStats(): Promise<AdminStats> {
  if (USE_MOCK) {
    return {
      totalVideos: 21,
      readyVideos: 21,
      processingVideos: 0,
      failedVideos: 0,
      totalChunks: 3482,
    };
  }
  return apiFetch<AdminStats>('/api/admin/stats');
}

export const PROCESSING_STAGES = [
  'queued',
  'uploading',
  'extracting_audio',
  'transcribing',
  'chunking',
  'embedding',
  'indexing',
  'completed',
] as const;

export function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    queued: 'Queued',
    uploading: 'Uploading',
    extracting_audio: 'Extracting audio',
    transcribing: 'Transcribing',
    chunking: 'Creating chunks',
    embedding: 'Generating embeddings',
    indexing: 'Indexing',
    completed: 'Completed ✓',
    failed: 'Failed',
  };
  return labels[stage] || stage;
}
