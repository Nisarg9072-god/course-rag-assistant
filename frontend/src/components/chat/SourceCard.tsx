import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Link2, Check, Tv2 } from 'lucide-react';
import type { RAGSource } from '@/types';
import { formatTime, padVideoNumber } from '@/utils/time';
import { cn } from '@/utils/cn';

interface SourceCardProps {
  source: RAGSource;
  index: number;
}

export function SourceCard({ source, index }: SourceCardProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const relevancePct = source.similarity != null
    ? Math.round(source.similarity * 100)
    : null;

  // URL for the video player with start + end timestamps
  const watchUrl = `/course/${source.number}?start=${Math.floor(source.start)}&end=${Math.ceil(source.end)}`;

  // Full share URL (absolute) for copying
  const shareUrl = `${window.location.origin}${watchUrl}`;

  const handleWatch = () => navigate(watchUrl);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select + copy
      const el = document.createElement('textarea');
      el.value = shareUrl;
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={cn(
        'rounded-xl border transition-all duration-200 overflow-hidden',
        'bg-white dark:bg-[#18181f]',
        'border-slate-200 dark:border-white/[0.06]',
        'hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-sm',
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        {/* Video badge */}
        <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400 shrink-0">
          #{padVideoNumber(source.number)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
              {source.title}
            </p>
            {relevancePct !== null && (
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 mt-0.5',
                relevancePct >= 85
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : relevancePct >= 70
                    ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400'
                    : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400',
              )}>
                {relevancePct}%
              </span>
            )}
          </div>

          {/* Timestamps */}
          <div className="flex items-center gap-1.5 mt-1">
            <Tv2 size={11} className="text-slate-400 dark:text-slate-500 shrink-0" />
            <span className="text-xs font-mono text-brand-600 dark:text-brand-400 font-semibold">
              {formatTime(source.start)}
            </span>
            {source.end > source.start && (
              <>
                <span className="text-slate-300 dark:text-slate-600 text-xs">→</span>
                <span className="text-xs font-mono text-brand-600 dark:text-brand-400 font-semibold">
                  {formatTime(source.end)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Excerpt */}
      {source.text && (
        <div className="px-4 pb-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 italic leading-relaxed border-l-2 border-brand-200 dark:border-brand-700/50 pl-3 line-clamp-2">
            "{source.text}"
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 px-4 pb-4">
        <button
          id={`source-watch-${source.number}-${Math.floor(source.start)}`}
          onClick={handleWatch}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors flex-1 justify-center"
          aria-label={`Watch section at ${formatTime(source.start)}`}
        >
          <Play size={11} className="fill-white" />
          Watch {formatTime(source.start)} → {formatTime(source.end)}
        </button>

        <button
          id={`source-share-${source.number}-${Math.floor(source.start)}`}
          onClick={handleShare}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shrink-0',
            copied
              ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
              : 'border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]',
          )}
          aria-label="Copy share link"
        >
          {copied
            ? <><Check size={11} /> Copied!</>
            : <><Link2 size={11} /> Share</>
          }
        </button>
      </div>
    </motion.div>
  );
}
