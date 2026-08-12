import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, Loader2, Sparkles, BookOpen, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageContainer } from '@/components/layout/PageContainer';
import { SearchResultCard } from '@/components/search/SearchResultCard';
import { searchCourse } from '@/api/search';
import { cn } from '@/utils/cn';

const EXAMPLE_SEARCHES = [
  'CSS box model',
  'HTML forms',
  'flexbox layout',
  'semantic tags',
  'CSS selectors',
  'Exercise 1',
];

const STAGE_MESSAGES = [
  { label: 'Searching course content…', delay: 0 },
  { label: 'Finding relevant lessons…', delay: 900 },
  { label: 'Ranking by relevance…',     delay: 1800 },
];

function SearchStages({ visible }: { visible: boolean }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!visible) { setStage(0); return; }
    const timers = STAGE_MESSAGES.map(({ delay }, i) =>
      setTimeout(() => setStage(i), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  if (!visible) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stage}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400"
      >
        <Loader2 size={16} className="animate-spin text-brand-500" />
        {STAGE_MESSAGES[stage].label}
      </motion.div>
    </AnimatePresence>
  );
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const initialQ = params.get('q') ?? '';
  const [inputValue, setInputValue] = useState(initialQ);
  const [query, setQuery] = useState(initialQ);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchCourse(query),
    enabled: query.trim().length > 0,
  });

  const handleSearch = (q?: string) => {
    const term = (q ?? inputValue).trim();
    if (!term) return;
    setInputValue(term);
    setQuery(term);
    setParams({ q: term });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = data?.results ?? [];
  const hasResults = results.length > 0;
  const hasSearched = query.trim().length > 0;

  return (
    <PageContainer>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-1">
            <SearchIcon size={20} className="text-brand-500" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Semantic Search
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Search across all course transcripts using AI embeddings
          </p>
        </motion.div>

        {/* ── Search bar ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6"
        >
          <div className={cn(
            'flex gap-2 p-1.5 rounded-2xl border transition-all',
            'bg-white dark:bg-[#18181f]',
            'border-slate-200 dark:border-white/[0.08]',
            'shadow-sm focus-within:shadow-md',
            'focus-within:border-brand-400 dark:focus-within:border-brand-600',
          )}>
            <div className="relative flex-1">
              <SearchIcon
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                type="text"
                placeholder="Search the course…"
                aria-label="Search the course"
                className="w-full pl-10 pr-4 py-2.5 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={!inputValue.trim() || isFetching}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                inputValue.trim() && !isFetching
                  ? 'bg-brand-600 hover:bg-brand-700 text-white'
                  : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 cursor-not-allowed',
              )}
            >
              {isFetching ? <Loader2 size={15} className="animate-spin" /> : <SearchIcon size={15} />}
              Search
            </button>
          </div>

          {/* Example pills */}
          {!hasSearched && (
            <div className="flex flex-wrap gap-2 mt-3">
              {EXAMPLE_SEARCHES.map(ex => (
                <button
                  key={ex}
                  onClick={() => handleSearch(ex)}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:border-brand-300 dark:hover:border-brand-700 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Loading state ────────────────────────────────────────────── */}
        {isFetching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-8 flex flex-col items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
              <Sparkles size={22} className="text-brand-500" />
            </div>
            <SearchStages visible={isFetching} />
          </motion.div>
        )}

        {/* ── Error state ──────────────────────────────────────────────── */}
        {isError && !isFetching && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50"
          >
            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Search failed</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                {error instanceof Error ? error.message : 'Make sure the backend is running and try again.'}
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Results ──────────────────────────────────────────────────── */}
        {hasSearched && !isFetching && !isError && (
          <AnimatePresence>
            {hasResults ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05 }}
              >
                {/* Result count */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {results.length} result{results.length !== 1 ? 's' : ''}
                    </span>
                    {' '}for <span className="text-brand-600 dark:text-brand-400 italic">"{query}"</span>
                  </p>
                </div>

                {/* Cards */}
                <div className="space-y-3">
                  {results.map((result, i) => (
                    <SearchResultCard key={`${result.number}-${result.start}`} result={result} index={i} />
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center py-16 text-center"
              >
                <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center mb-4">
                  <BookOpen size={24} className="text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-700 dark:text-slate-300 font-medium mb-1">
                  No results found
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs">
                  Try different keywords or check your spelling. The search is semantic — you can phrase it naturally.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* ── Empty / intro state ──────────────────────────────────────── */}
        {!hasSearched && !isFetching && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center py-16 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg shadow-brand-500/20">
              <SearchIcon size={28} className="text-white" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Search across all course lessons
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
              The search uses the same AI embeddings as the chatbot — it understands meaning, not just keywords.
            </p>
          </motion.div>
        )}

      </div>
    </PageContainer>
  );
}
