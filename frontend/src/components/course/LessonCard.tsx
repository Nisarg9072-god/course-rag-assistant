import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Clock, CheckCircle2 } from 'lucide-react';
import type { CourseVideo } from '@/types';
import { formatDuration, padVideoNumber } from '@/utils/time';
import { isLessonCompleted } from '@/utils/storage';
import { cn } from '@/utils/cn';

interface LessonCardProps {
  video: CourseVideo;
  index?: number;
}

export function LessonCard({ video, index = 0 }: LessonCardProps) {
  const navigate = useNavigate();
  const completed = isLessonCompleted(video.number);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={() => navigate(`/course/${video.number}`)}
      className={cn(
        'group flex items-center gap-4 p-4 rounded-xl border cursor-pointer',
        'bg-white dark:bg-[#18181f]',
        'border-slate-200 dark:border-white/[0.06]',
        'hover:border-brand-300 dark:hover:border-brand-700',
        'hover:shadow-sm transition-all duration-200',
      )}
    >
      {/* Number */}
      <div className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold',
        completed
          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
          : 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
      )}>
        {completed ? <CheckCircle2 size={18} /> : `#${padVideoNumber(video.number)}`}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
          {video.title}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <Clock size={11} /> {formatDuration(video.duration)}
          </span>
          <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">{video.chunkCount} segments</span>
        </div>
      </div>

      {/* Play */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all',
        'bg-slate-100 dark:bg-white/[0.06] group-hover:bg-brand-600',
        'text-slate-400 dark:text-slate-500 group-hover:text-white',
      )}>
        <Play size={14} className="fill-current ml-0.5" />
      </div>
    </motion.div>
  );
}
