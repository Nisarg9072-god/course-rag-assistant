// ─── Core domain types ────────────────────────────────────────────────────────

export interface CourseVideo {
  number: number;
  title: string;
  duration: number;       // seconds
  chunkCount: number;
  videoFile?: string;     // filename in Video/ folder
  videoUrl?: string;      // full URL if served by backend
}

export interface TranscriptChunk {
  number: number | string;
  title: string;
  start: number;          // seconds
  end: number;            // seconds
  text: string;
}

export interface RAGSource {
  number: number;
  title: string;
  start: number;          // seconds
  end: number;            // seconds
  text: string;
  similarity?: number;    // 0–1, optional
}

export interface RAGResponse {
  answer: string;
  sources: RAGSource[];
}

export interface SearchResult {
  number: number;
  title: string;
  start: number;
  end: number;
  text: string;
  similarity?: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

export interface CourseStats {
  videoCount: number;
  totalDurationSeconds: number;
  totalDurationHours: number;
  totalChunks: number;
  embeddingsLoaded: boolean;
}

// ─── Chat types ───────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  sources?: RAGSource[];
  timestamp: number;      // Date.now()
  isError?: boolean;
}

// ─── UI / app types ───────────────────────────────────────────────────────────

export interface RecentQuestion {
  id: string;
  question: string;
  timestamp: number;
}

export interface LessonProgress {
  videoNumber: number;
  completed: boolean;
  watchedSeconds?: number;
}
