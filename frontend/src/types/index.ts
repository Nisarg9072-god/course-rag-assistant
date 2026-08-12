// ─── Core domain types ────────────────────────────────────────────────────────

export interface CourseVideo {
  id?: string;
  number: number;
  title: string;
  duration: number;
  chunkCount: number;
  videoFile?: string;
  videoUrl?: string;
  status?: VideoStatus;
  sourceType?: 'upload' | 'youtube';
  youtubeVideoId?: string;
  sourceUrl?: string;
  processingStage?: string;
  job?: {
    id: string;
    status: string;
    stage: string;
    progress: number;
    errorMessage?: string;
  };
}

export type VideoStatus =
  | 'queued'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'failed';

export interface ProcessingJob {
  id: string;
  videoId?: number;
  videoTitle?: string;
  status: string;
  stage: string;
  progress: number;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminStats {
  totalVideos: number;
  readyVideos: number;
  processingVideos: number;
  failedVideos: number;
  totalChunks: number;
}

export interface UploadVideoResponse {
  video_id: string;
  videoId: number;
  job_id: string;
  status: string;
}

export interface TranscriptChunk {
  number: number | string;
  title: string;
  start: number;          // seconds
  end: number;            // seconds
  text: string;
}

export interface RAGSource {
  videoId?: string;
  videoNumber?: number;
  number: number;
  title: string;
  start: number;          // seconds
  end: number;            // seconds
  text: string;
  similarity?: number;    // 0–1, optional
  videoUrl?: string;      // /api/videos/N/stream
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
  totalVideos?: number;
  readyVideos?: number;
  processingVideos?: number;
  failedVideos?: number;
  totalDurationSeconds: number;
  totalDurationHours: number;
  totalChunks: number;
  indexedChunks?: number;
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
