import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Sparkles, Trash2 } from 'lucide-react';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { ThinkingIndicator } from '@/components/chat/ThinkingIndicator';
import type { ChatMessage as ChatMessageType } from '@/types';
import { askQuestion, askAboutVideo } from '@/api/questions';
import { useLocalHistory } from '@/hooks/useLocalHistory';
import { getChatHistory, saveChatHistory, clearChatHistory } from '@/utils/storage';

const SUGGESTION_PILLS = [
  'What is the CSS box model?',
  'Where is Exercise 1?',
  'Explain flexbox',
  'CSS selectors',
];

export default function AskAI() {
  const [params] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessageType[]>(getChatHistory);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { push: pushHistory } = useLocalHistory();
  const abortRef = useRef(false);

  // Save chat on change
  useEffect(() => { saveChatHistory(messages); }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Handle ?q= param from Dashboard
  useEffect(() => {
    const q = params.get('q');
    if (q && messages.length === 0) {
      handleSubmit(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = useCallback(async (question: string) => {
    if (loading) return;
    abortRef.current = false;

    const scopedVideoId = params.get('videoId');
    const vidNum = scopedVideoId ? parseInt(scopedVideoId, 10) : null;

    const userMsg: ChatMessageType = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    pushHistory(question);

    try {
      const response = vidNum && !Number.isNaN(vidNum)
        ? await askAboutVideo(question, vidNum)
        : await askQuestion(question);
      if (abortRef.current) return;

      const aiMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: unknown) {
      if (abortRef.current) return;
      const error = err instanceof Error ? err : new Error('Unknown error');
      const errMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Couldn't get a response. ${error.message || 'Make sure the backend is running and try again.'}`,
        timestamp: Date.now(),
        isError: true,
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [loading, pushHistory, params]);

  const handleClear = () => {
    setMessages([]);
    clearChatHistory();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full max-h-full overflow-hidden bg-slate-50 dark:bg-[#0a0a0f]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#111118] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Course AI Assistant
              {params.get('videoId') && (
                <span className="ml-2 text-xs font-normal text-brand-500">
                  · Video #{params.get('videoId')}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">Powered by LLaMA 3.2 + bge-m3</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors"
            aria-label="Clear chat"
          >
            <Trash2 size={13} /> Clear
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-brand-500/20">
              <Sparkles size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Ask anything about your course</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-8">
              The AI searches your course transcripts and points you to the exact video and timestamp.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTION_PILLS.map(q => (
                <button
                  key={q}
                  onClick={() => handleSubmit(q)}
                  className="text-sm px-4 py-2 rounded-full border border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-slate-400 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 dark:hover:text-brand-400 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            <AnimatePresence initial={false}>
              {messages.map(msg => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {loading && <ThinkingIndicator key="thinking" />}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSubmit={handleSubmit}
        loading={loading}
        onStop={() => { abortRef.current = true; setLoading(false); }}
      />
    </div>
  );
}
