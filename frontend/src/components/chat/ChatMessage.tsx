import { motion } from 'framer-motion';
import { Tv2 } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@/types';
import { SourceCard } from './SourceCard';
import { timeAgo } from '@/utils/time';
import { cn } from '@/utils/cn';

interface ChatMessageProps {
  message: ChatMessageType;
}

function renderAIText(text: string) {
  // Convert **bold** to <strong> and newlines to <br>
  const parts = text.split('\n').map((line, i) => {
    const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return <p key={i} dangerouslySetInnerHTML={{ __html: bold || '&nbsp;' }} className="min-h-[1rem]" />;
  });
  return parts;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="flex justify-end"
      >
        <div className="max-w-[75%]">
          <div className="bg-brand-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
            {message.content}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 text-right pr-1">{timeAgo(message.timestamp)}</p>
        </div>
      </motion.div>
    );
  }

  // AI message
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3"
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
        AI
      </div>

      <div className="flex-1 min-w-0">
        {/* Answer prose */}
        <div className={cn(
          'text-sm leading-relaxed ai-prose text-slate-800 dark:text-slate-200',
          message.isError && 'text-red-500 dark:text-red-400'
        )}>
          {renderAIText(message.content)}
        </div>
        <p className="text-[10px] text-slate-400 mt-2">{timeAgo(message.timestamp)}</p>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Tv2 size={14} className="text-brand-500" />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Relevant Course Lessons
              </p>
            </div>
            <div className="grid gap-2">
              {message.sources.map((src, i) => (
                <SourceCard key={`${src.number}-${src.start}`} source={src} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
