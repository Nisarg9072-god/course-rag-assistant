import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, ExternalLink } from 'lucide-react';
import type { RAGSource } from '@/types';
import { formatTime, padVideoNumber } from '@/utils/time';
import { cn } from '@/utils/cn';

interface SourceCardProps {
  source: RAGSource;
  index: number;
}

export function SourceCard({ source, index }: SourceCardProps) {
  const navigate = useNavigate();
  const timeStr = formatTime(source.start);
  const hasSimilarity = typeof source.similarity === 'number';

  const handleWatch = () => {
    navigate(`/course/${source.number}?time=${Math.floor(source.start)}`);
  };

  const relevancePct = hasSimilarity ? Math.round((source.similarity ?? 0) * 100) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="group rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#18181f] hover:border-brand-300 dark:hover:border-brand-700 transition-all duration-200 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Number badge */}
          <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
              #{padVideoNumber(source.number)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate leading-tight">
              {source.title}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              ⏱ {timeStr}
              {source.end && source.end > source.start && ` – ${formatTime(source.end)}`}
            </p>
          </div>
        </div>
        {/* Relevance badge */}
        {relevancePct !== null && (
          <div className={cn(
            'shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full',
            relevancePct >= 90 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
            relevancePct >= 75 ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400' :
                                 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
          )}>
            {relevancePct}%
          </div>
        )}
      </div>

      {/* Transcript snippet */}
      {source.text && (
        <div className="px-4 pb-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2 leading-relaxed border-l-2 border-slate-200 dark:border-white/[0.08] pl-3">
            "{source.text.trim()}"
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-4 flex items-center gap-2">
        <button
          onClick={handleWatch}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors"
        >
          <Play size={12} className="fill-white" />
          Watch from {timeStr}
        </button>
        <button
          onClick={handleWatch}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] text-xs font-medium transition-colors"
        >
          <ExternalLink size={11} />
          Open
        </button>
      </div>
    </motion.div>
  );
}
