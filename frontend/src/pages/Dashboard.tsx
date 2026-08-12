import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, BookOpen, Layers, Cpu, ArrowRight, Clock } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { getStats, getVideos } from '@/api/videos';
import { useLocalHistory } from '@/hooks/useLocalHistory';
import { timeAgo } from '@/utils/time';
import { cn } from '@/utils/cn';

const EXAMPLE_QUESTIONS = [
  'What is the CSS box model?',
  'Where is Exercise 1 explained?',
  'Explain flexbox in simple terms',
  'Which video covers CSS positioning?',
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { history } = useLocalHistory();

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  const { data: videos = [] } = useQuery({
    queryKey: ['videos'],
    queryFn: getVideos,
    refetchInterval: (query) => {
      const list = query.state.data ?? [];
      return list.some(v => v.status === 'processing' || v.status === 'queued') ? 5000 : false;
    },
  });

  const recentlyAdded = [...videos]
    .filter(v => !v.status || v.status === 'ready')
    .slice(-3)
    .reverse();

  const handleAsk = (q?: string) => {
    const query = q || searchQuery;
    if (query.trim()) {
      navigate(`/ask?q=${encodeURIComponent(query.trim())}`);
    } else {
      navigate('/ask');
    }
  };

  const STATS_CARDS = [
    { label: 'Videos',           value: stats ? `${stats.videoCount}+`                : '21+',   icon: BookOpen, color: 'text-brand-500' },
    { label: 'Course Content',   value: stats ? `${stats.totalDurationHours}h+`       : '5h+',   icon: Clock,    color: 'text-purple-500' },
    { label: 'Transcript Chunks',value: stats ? `${stats.totalChunks.toLocaleString()}+` : '2K+', icon: Layers,   color: 'text-emerald-500' },
    { label: 'AI Powered',       value: 'LLaMA 3.2',                                              icon: Cpu,      color: 'text-amber-500' },
  ];

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 lg:py-16">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700/50 text-brand-600 dark:text-brand-400 text-xs font-semibold mb-6">
            <Sparkles size={12} />
            AI-Powered Course Search
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-slate-100 mb-4 leading-tight tracking-tight">
            Your Course.<br />
            <span className="gradient-text">Now Searchable.</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed mb-10">
            Ask questions about your web development course.
            The AI finds the exact lesson and timestamp so you can jump right in.
          </p>

          {/* Search bar */}
          <div className="max-w-xl mx-auto">
            <div className="flex gap-2 p-1.5 rounded-2xl bg-white dark:bg-[#18181f] border border-slate-200 dark:border-white/[0.08] shadow-md dark:shadow-black/30">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAsk()}
                type="text"
                placeholder="Ask anything about this course..."
                className="flex-1 px-4 py-2.5 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                aria-label="Ask a course question"
              />
              <button
                onClick={() => handleAsk()}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Ask AI
                <ArrowRight size={15} />
              </button>
            </div>

            {/* Example pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {EXAMPLE_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => handleAsk(q)}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:border-brand-300 dark:hover:border-brand-700 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all"
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-12"
        >
          {STATS_CARDS.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white dark:bg-[#18181f] rounded-xl border border-slate-200 dark:border-white/[0.06] p-4 text-center">
              <Icon size={20} className={cn('mx-auto mb-2', color)} />
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </motion.div>

        {/* ── How it works ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { step: '01', title: 'Ask a Question', desc: 'Type anything about your web development course — concepts, exercises, CSS, HTML, and more.' },
              { step: '02', title: 'AI Searches Transcripts', desc: 'The AI embeds your question and finds the most relevant lecture segments using semantic search.' },
              { step: '03', title: 'Jump to the Lesson', desc: 'See the exact video and timestamp. Click once to open the video player at the precise moment.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="bg-white dark:bg-[#18181f] rounded-xl border border-slate-200 dark:border-white/[0.06] p-5">
                <span className="text-xs font-bold text-brand-500 tracking-wider">{step}</span>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1 mb-2">{title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Quick actions ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="grid sm:grid-cols-2 gap-3 mb-12"
        >
          <button
            onClick={() => navigate('/course')}
            className="group flex items-center gap-4 p-5 bg-white dark:bg-[#18181f] rounded-xl border border-slate-200 dark:border-white/[0.06] hover:border-brand-300 dark:hover:border-brand-700 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
              <BookOpen size={20} className="text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">Browse Course</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">All 21 lessons in one place</p>
            </div>
            <ArrowRight size={16} className="ml-auto text-slate-300 dark:text-slate-600 group-hover:text-brand-500 transition-colors" />
          </button>

          <button
            onClick={() => navigate('/ask')}
            className="group flex items-center gap-4 p-5 bg-brand-600 hover:bg-brand-700 rounded-xl transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Ask the AI</p>
              <p className="text-xs text-brand-200 mt-0.5">Get instant answers with timestamps</p>
            </div>
            <ArrowRight size={16} className="ml-auto text-brand-200" />
          </button>
        </motion.div>

        {/* ── Recently added ──────────────────────────────────────────────── */}
        {recentlyAdded.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="mb-12"
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Recently added</h2>
            <div className="space-y-2">
              {recentlyAdded.map(v => (
                <button
                  key={v.number}
                  onClick={() => navigate(`/course/${v.number}`)}
                  className="w-full flex items-center justify-between p-3.5 bg-white dark:bg-[#18181f] rounded-xl border border-slate-200 dark:border-white/[0.06] hover:border-brand-300 text-left"
                >
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    #{String(v.number).padStart(2, '0')} {v.title}
                  </span>
                  <span className="text-xs text-emerald-500">✓ Ready</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Recent Questions ──────────────────────────────────────────────── */}
        {history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Recent Questions</h2>
            <div className="space-y-2">
              {history.slice(0, 5).map(item => (
                <button
                  key={item.id}
                  onClick={() => handleAsk(item.question)}
                  className="w-full flex items-center justify-between gap-3 p-3.5 bg-white dark:bg-[#18181f] rounded-xl border border-slate-200 dark:border-white/[0.06] hover:border-brand-300 dark:hover:border-brand-700 transition-all group text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Clock size={14} className="text-slate-400 shrink-0" />
                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {item.question}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{timeAgo(item.timestamp)}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Powered by ────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-xs text-slate-300 dark:text-slate-600">
            Powered by{' '}
            <span className="text-slate-500 dark:text-slate-400 font-medium">Whisper</span>
            {' · '}
            <span className="text-slate-500 dark:text-slate-400 font-medium">bge-m3</span>
            {' · '}
            <span className="text-slate-500 dark:text-slate-400 font-medium">LLaMA 3.2</span>
            {' · '}
            <span className="text-slate-500 dark:text-slate-400 font-medium">Ollama</span>
          </p>
        </motion.div>
      </div>
    </PageContainer>
  );
}
