import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { TranscriptChunk } from '@/types';
import { formatTime } from '@/utils/time';
import { cn } from '@/utils/cn';

interface TranscriptProps {
  chunks: TranscriptChunk[];
  currentTime: number;
  onSeek: (seconds: number) => void;
  /** If provided, chunks overlapping [highlightStart, highlightEnd] get a "relevant section" badge */
  highlightStart?: number;
  highlightEnd?: number;
}

export function Transcript({ chunks, currentTime, onSeek, highlightStart, highlightEnd }: TranscriptProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  const activeIndex = chunks.findLastIndex(c => currentTime >= c.start);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeIndex]);

  if (chunks.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-sm">
        No transcript available for this video.
      </div>
    );
  }

  const isInSection = (chunk: TranscriptChunk) => {
    if (highlightStart === undefined) return false;
    const end = highlightEnd ?? highlightStart + 1;
    return chunk.start < end && (chunk.end ?? chunk.start + 30) > highlightStart;
  };

  return (
    <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
      {chunks.map((chunk, i) => {
        const isActive  = i === activeIndex;
        const inSection = isInSection(chunk);

        return (
          <button
            key={i}
            ref={isActive ? activeRef : undefined}
            onClick={() => onSeek(chunk.start)}
            className={cn(
              'w-full text-left flex gap-3 px-4 py-3 transition-all duration-150 group relative',
              isActive
                ? 'bg-brand-50 dark:bg-brand-900/20'
                : inSection
                  ? 'bg-amber-50/60 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                  : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]',
            )}
          >
            {/* Active bar */}
            {isActive && (
              <motion.div
                layoutId="transcript-active"
                className="w-0.5 h-full bg-brand-500 rounded-full absolute left-0 top-0"
              />
            )}

            {/* Section bar */}
            {inSection && !isActive && (
              <div className="w-0.5 h-full bg-amber-400 dark:bg-amber-500 rounded-full absolute left-0 top-0" />
            )}

            {/* Timestamp */}
            <span className={cn(
              'text-xs font-mono shrink-0 mt-0.5 font-semibold tabular-nums',
              isActive
                ? 'text-brand-600 dark:text-brand-400'
                : inSection
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-400 dark:text-slate-500 group-hover:text-brand-500',
            )}>
              {formatTime(chunk.start)}
            </span>

            {/* Text */}
            <div className="flex-1 min-w-0">
              {inSection && (
                <span className="inline-block text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full mb-1">
                  ✨ Relevant section
                </span>
              )}
              <p className={cn(
                'text-sm leading-relaxed',
                isActive
                  ? 'text-slate-900 dark:text-slate-100 font-medium'
                  : inSection
                    ? 'text-slate-700 dark:text-slate-300'
                    : 'text-slate-600 dark:text-slate-400',
              )}>
                {chunk.text}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
