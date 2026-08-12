import { useState, useCallback } from 'react';
import type { RecentQuestion } from '@/types';
import { getRecentQuestions, addRecentQuestion, clearRecentQuestions } from '@/utils/storage';

export function useLocalHistory() {
  const [history, setHistory] = useState<RecentQuestion[]>(getRecentQuestions);

  const push = useCallback((question: string) => {
    addRecentQuestion(question);
    setHistory(getRecentQuestions());
  }, []);

  const clear = useCallback(() => {
    clearRecentQuestions();
    setHistory([]);
  }, []);

  return { history, push, clear };
}
