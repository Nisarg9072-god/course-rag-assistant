import type { SearchResponse } from '@/types';
import { apiFetch, USE_MOCK } from './client';
import { mockSearchCourse } from './mock';

export async function searchCourse(query: string): Promise<SearchResponse> {
  if (USE_MOCK) return mockSearchCourse(query);
  return apiFetch<SearchResponse>(
    `/api/search?q=${encodeURIComponent(query)}`,
  );
}
