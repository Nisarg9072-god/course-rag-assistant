import type { RAGResponse } from '@/types';
import { apiFetch, USE_MOCK } from './client';
import { mockAskQuestion } from './mock';

export async function askQuestion(question: string): Promise<RAGResponse> {
  if (USE_MOCK) return mockAskQuestion(question);
  return apiFetch<RAGResponse>('/api/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}
