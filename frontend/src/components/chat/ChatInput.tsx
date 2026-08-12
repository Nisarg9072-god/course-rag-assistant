import { useState, useRef, useEffect } from 'react';
import { Send, StopCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ChatInputProps {
  onSubmit: (question: string) => void;
  loading: boolean;
  onStop?: () => void;
}

const PLACEHOLDER_SUGGESTIONS = [
  'What is the CSS box model?',
  'Where is Exercise 1 explained?',
  'Explain flexbox in simple terms',
  'Which video covers CSS positioning?',
  'How do I use semantic HTML tags?',
];

export function ChatInput({ onSubmit, loading, onStop }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [placeholder] = useState(
    () => PLACEHOLDER_SUGGESTIONS[Math.floor(Math.random() * PLACEHOLDER_SUGGESTIONS.length)]
  );

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [value]);

  const handleSubmit = () => {
    const q = value.trim();
    if (!q || loading) return;
    onSubmit(q);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#111118] p-4">
      <div className="max-w-3xl mx-auto">
        <div className={cn(
          'flex items-end gap-3 rounded-xl border transition-all',
          'bg-slate-50 dark:bg-[#18181f]',
          loading
            ? 'border-brand-300 dark:border-brand-700'
            : 'border-slate-200 dark:border-white/[0.08] focus-within:border-brand-400 dark:focus-within:border-brand-600'
        )}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder={placeholder}
            rows={1}
            aria-label="Ask a question about the course"
            className="flex-1 resize-none bg-transparent px-4 py-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none leading-relaxed"
          />

          <div className="p-2 shrink-0">
            {loading ? (
              <button
                onClick={onStop}
                className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-white/[0.08] text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-colors"
                aria-label="Stop generating"
              >
                <StopCircle size={18} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!value.trim()}
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center transition-all',
                  value.trim()
                    ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm'
                    : 'bg-slate-200 dark:bg-white/[0.06] text-slate-400 cursor-not-allowed'
                )}
                aria-label="Send question"
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-600 text-center mt-2">
          Ask anything about your web development course · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
