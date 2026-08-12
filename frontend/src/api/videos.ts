import type { CourseVideo, TranscriptChunk, CourseStats } from '@/types';
import { apiFetch, USE_MOCK } from './client';
import { mockGetVideos, mockGetVideo, mockGetStats } from './mock';

export async function getVideos(): Promise<CourseVideo[]> {
  if (USE_MOCK) return mockGetVideos();
  return apiFetch<CourseVideo[]>('/api/videos');
}

export async function getVideo(
  id: number,
): Promise<CourseVideo & { transcript: TranscriptChunk[] }> {
  if (USE_MOCK) return mockGetVideo(id);
  return apiFetch<CourseVideo & { transcript: TranscriptChunk[] }>(
    `/api/videos/${id}`,
  );
}

export async function getStats(): Promise<CourseStats> {
  if (USE_MOCK) return mockGetStats();
  return apiFetch<CourseStats>('/api/stats');
}
