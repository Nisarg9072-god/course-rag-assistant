import type { RecentQuestion, LessonProgress, ChatMessage } from '@/types';

const KEYS = {
  recentQuestions: 'rag_recent_questions',
  lessonProgress: 'rag_lesson_progress',
  chatHistory: 'rag_chat_history',
  theme: 'rag_theme',
} as const;

// ─── Recent Questions ─────────────────────────────────────────────────────────

export function getRecentQuestions(): RecentQuestion[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.recentQuestions) || '[]');
  } catch {
    return [];
  }
}

export function addRecentQuestion(question: string): void {
  const existing = getRecentQuestions();
  const entry: RecentQuestion = {
    id: crypto.randomUUID(),
    question,
    timestamp: Date.now(),
  };
  // Deduplicate by question text
  const filtered = existing.filter(q => q.question !== question);
  const updated = [entry, ...filtered].slice(0, 10);
  localStorage.setItem(KEYS.recentQuestions, JSON.stringify(updated));
}

export function clearRecentQuestions(): void {
  localStorage.removeItem(KEYS.recentQuestions);
}

// ─── Lesson Progress ──────────────────────────────────────────────────────────

export function getLessonProgress(): LessonProgress[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.lessonProgress) || '[]');
  } catch {
    return [];
  }
}

export function markLessonComplete(videoNumber: number): void {
  const progress = getLessonProgress();
  const existing = progress.find(p => p.videoNumber === videoNumber);
  if (existing) {
    existing.completed = true;
  } else {
    progress.push({ videoNumber, completed: true });
  }
  localStorage.setItem(KEYS.lessonProgress, JSON.stringify(progress));
}

export function isLessonCompleted(videoNumber: number): boolean {
  const progress = getLessonProgress();
  return progress.some(p => p.videoNumber === videoNumber && p.completed);
}

export function getCompletedCount(): number {
  return getLessonProgress().filter(p => p.completed).length;
}

// ─── Chat History ─────────────────────────────────────────────────────────────

export function getChatHistory(): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.chatHistory) || '[]');
  } catch {
    return [];
  }
}

export function saveChatHistory(messages: ChatMessage[]): void {
  // Keep only last 50 messages
  localStorage.setItem(KEYS.chatHistory, JSON.stringify(messages.slice(-50)));
}

export function clearChatHistory(): void {
  localStorage.removeItem(KEYS.chatHistory);
}

// ─── Theme ────────────────────────────────────────────────────────────────────

export function getSavedTheme(): 'light' | 'dark' {
  return (localStorage.getItem(KEYS.theme) as 'light' | 'dark') || 'dark';
}

export function saveTheme(theme: 'light' | 'dark'): void {
  localStorage.setItem(KEYS.theme, theme);
}
