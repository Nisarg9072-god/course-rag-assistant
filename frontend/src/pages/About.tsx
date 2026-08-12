import { motion } from 'framer-motion';
import { PageContainer } from '@/components/layout/PageContainer';
import {
  Video, Music, FileText, Database, Cpu, MessageSquare,
  ArrowRight, ExternalLink, Zap, BookOpen, Search, Sparkles
} from 'lucide-react';

const PIPELINE_STEPS = [
  {
    icon: Video,
    label: 'Course Videos',
    sublabel: '.mp4 files',
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800/40',
  },
  {
    icon: Music,
    label: 'Audio Extraction',
    sublabel: 'Video → MP3',
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800/40',
  },
  {
    icon: FileText,
    label: 'Transcription',
    sublabel: 'OpenAI Whisper',
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800/40',
  },
  {
    icon: Database,
    label: 'Chunked JSON',
    sublabel: 'Timestamped segments',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800/40',
  },
  {
    icon: Cpu,
    label: 'Embeddings',
    sublabel: 'bge-m3 model',
    color: 'text-brand-500',
    bg: 'bg-brand-50 dark:bg-brand-900/20',
    border: 'border-brand-200 dark:border-brand-800/40',
  },
  {
    icon: Search,
    label: 'Vector Search',
    sublabel: 'Cosine similarity',
    color: 'text-violet-500',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-200 dark:border-violet-800/40',
  },
  {
    icon: MessageSquare,
    label: 'AI Answer',
    sublabel: 'LLaMA 3.2 via Ollama',
    color: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800/40',
  },
];

const TECH_STACK = [
  { category: 'Transcription',   items: ['OpenAI Whisper', 'ffmpeg'],                       color: 'text-amber-500' },
  { category: 'Embeddings',      items: ['bge-m3', 'Ollama'],                               color: 'text-brand-500' },
  { category: 'Vector Search',   items: ['NumPy', 'scikit-learn', 'cosine similarity'],     color: 'text-emerald-500' },
  { category: 'LLM',             items: ['LLaMA 3.2', 'Ollama'],                            color: 'text-purple-500' },
  { category: 'Backend',         items: ['Flask', 'Flask-CORS', 'joblib', 'pandas'],        color: 'text-red-500' },
  { category: 'Frontend',        items: ['React 19', 'Vite', 'TypeScript', 'Tailwind CSS'], color: 'text-blue-500' },
  { category: 'State & Data',    items: ['TanStack Query', 'React Router', 'localStorage'], color: 'text-orange-500' },
  { category: 'Animations',      items: ['Framer Motion', 'Lucide React'],                  color: 'text-pink-500' },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI-Powered Q&A',
    desc: 'Ask any question about your course. The AI finds the most relevant transcript segments and generates a contextual answer with exact timestamps.',
  },
  {
    icon: Search,
    title: 'Semantic Search',
    desc: 'Search by meaning, not just keywords. bge-m3 embeddings understand the intent behind your query and find related lessons across the entire course.',
  },
  {
    icon: BookOpen,
    title: 'Timestamp Navigation',
    desc: 'Every AI response includes source cards with "Watch from 04:32" buttons. Click once to open the video player at the exact moment.',
  },
  {
    icon: Zap,
    title: 'Interactive Transcript',
    desc: 'The video player shows a live, clickable transcript. The currently-playing segment is highlighted automatically. Click any timestamp to seek.',
  },
];

export default function About() {
  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700/50 text-brand-600 dark:text-brand-400 text-xs font-semibold mb-5">
            <Sparkles size={12} />
            RAG Architecture
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3 tracking-tight">
            How the AI Works
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
            Course RAG Assistant uses Retrieval-Augmented Generation (RAG) to ground every AI answer
            in the actual content of your course transcripts.
          </p>
        </motion.div>

        {/* ── Pipeline ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-14"
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6">
            Processing Pipeline
          </h2>
          <div className="overflow-x-auto pb-2">
            <div className="flex items-center gap-0 min-w-max">
              {PIPELINE_STEPS.map(({ icon: Icon, label, sublabel, color, bg, border }, i) => (
                <div key={label} className="flex items-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.07 }}
                    className={`flex flex-col items-center p-4 rounded-xl border ${bg} ${border} w-32`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-2`}>
                      <Icon size={20} className={color} />
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 text-center leading-tight">
                      {label}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-0.5">
                      {sublabel}
                    </p>
                  </motion.div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <ArrowRight size={14} className="text-slate-300 dark:text-slate-600 mx-1 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Features ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-14"
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-5">
            Key Features
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }}
                className="bg-white dark:bg-[#18181f] rounded-xl border border-slate-200 dark:border-white/[0.06] p-5 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-brand-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">{title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Tech Stack ────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-14"
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-5">
            Technology Stack
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TECH_STACK.map(({ category, items, color }, i) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="bg-white dark:bg-[#18181f] rounded-xl border border-slate-200 dark:border-white/[0.06] p-4"
              >
                <p className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${color}`}>{category}</p>
                <div className="space-y-1.5">
                  {items.map(item => (
                    <p key={item} className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                      {item}
                    </p>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── RAG explanation ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-[#18181f] rounded-xl border border-slate-200 dark:border-white/[0.06] p-6 mb-8"
        >
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Why RAG?
          </h2>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            <p>
              Standard LLMs can't answer questions about <em>your specific course</em> because they don't have access to it.
              Retrieval-Augmented Generation (RAG) solves this by first searching the course content,
              then providing the relevant excerpts as context to the LLM.
            </p>
            <p>
              Every question you ask is embedded into a vector using <strong className="text-slate-700 dark:text-slate-300">bge-m3</strong>,
              then compared against pre-computed embeddings of all transcript chunks using cosine similarity.
              The top matches are sent to <strong className="text-slate-700 dark:text-slate-300">LLaMA 3.2</strong> along with your question.
            </p>
            <p>
              The result: answers that are grounded in your actual course content, with exact video numbers and timestamps.
            </p>
          </div>
        </motion.div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <ExternalLink size={16} />
            View on GitHub
          </a>
          <p className="text-xs text-slate-300 dark:text-slate-600 mt-4">
            Powered by Whisper · bge-m3 · LLaMA 3.2 · Ollama · Flask · React · Vite
          </p>
        </motion.div>

      </div>
    </PageContainer>
  );
}
