import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, ExternalLink } from 'lucide-react';
import type { SearchResult } from '@/types';
import { formatTime, padVideoNumber } from '@/utils/time';
import { cn } from '@/utils/cn';

interface SearchResultCardProps {
  result: SearchResult;
  index: number;
}

export function SearchResultCard({ result, index }: SearchResultCardProps) {
  const navigate = useNavigate();
  const relevancePct = result.similarity != null ? Math.round(result.similarity * 100) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="group bg-white dark:bg-[#18181f] rounded-xl border border-slate-200 dark:border-white/[0.06] hover:border-brand-300 dark:hover:border-brand-700 transition-all duration-200"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400 shrink-0">
              #{padVideoNumber(result.number)}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{result.title}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                ⏱ {formatTime(result.start)}
                {result.end > result.start && ` – ${formatTime(result.end)}`}
              </p>
            </div>
          </div>
          {relevancePct !== null && (
            <div className={cn(
              'text-xs font-semibold px-2 py-0.5 rounded-full shrink-0',
              relevancePct >= 85 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
              relevancePct >= 70 ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400' :
                                   'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
            )}>
              {relevancePct}% match
            </div>
          )}
        </div>

        {result.text && (
          <p className="text-xs text-slate-500 dark:text-slate-400 italic leading-relaxed border-l-2 border-slate-200 dark:border-white/[0.1] pl-3 mb-4 line-clamp-2">
            "{result.text}"
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/course/${result.number}?time=${Math.floor(result.start)}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors"
          >
            <Play size={11} className="fill-white" />
            Watch from {formatTime(result.start)}
          </button>
          <button
            onClick={() => navigate(`/course/${result.number}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] text-xs font-medium transition-colors"
          >
            <ExternalLink size={11} />
            Open Video
          </button>
        </div>
      </div>
    </motion.div>
  );
}
