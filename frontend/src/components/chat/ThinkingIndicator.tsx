import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Stage {
  label: string;
  delay: number; // ms from start when this stage becomes active
}

const STAGES: Stage[] = [
  { label: 'Searching course transcripts…', delay: 0 },
  { label: 'Finding relevant lessons…',      delay: 1200 },
  { label: 'Generating answer…',             delay: 2600 },
];

export function ThinkingIndicator() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const timers = STAGES.map(({ delay }, i) =>
      setTimeout(() => setActiveStage(i), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex items-start gap-3"
    >
      {/* AI Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 shadow-sm shadow-brand-500/30">
        AI
      </div>

      <div className="flex flex-col gap-3 pt-1">
        {/* Animated dots */}
        <div className="dot-pulse flex items-center gap-1 text-brand-500">
          <span /><span /><span />
        </div>

        {/* Stages list */}
        <div className="flex flex-col gap-1.5">
          {STAGES.map((stage, i) => {
            const isDone    = i < activeStage;
            const isActive  = i === activeStage;
            const isPending = i > activeStage;

            return (
              <motion.div
                key={stage.label}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: isPending ? 0.3 : 1, x: 0 }}
                transition={{ delay: i * 0.15, duration: 0.3 }}
                className="flex items-center gap-2"
              >
                {/* Status indicator */}
                <div className="relative w-3 h-3 shrink-0 flex items-center justify-center">
                  {isDone && (
                    <motion.svg
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      viewBox="0 0 12 12"
                      className="w-3 h-3 text-emerald-500"
                      fill="currentColor"
                    >
                      <path d="M1.5 6l3 3 6-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                  )}
                  {isActive && (
                    <motion.span
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                      className="w-2 h-2 rounded-full bg-brand-500"
                    />
                  )}
                  {isPending && (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                  )}
                </div>

                {/* Label */}
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`${i}-${isActive}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`text-xs ${
                      isDone
                        ? 'text-emerald-500 dark:text-emerald-400 line-through opacity-70'
                        : isActive
                          ? 'text-slate-700 dark:text-slate-300 font-medium'
                          : 'text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    {stage.label}
                  </motion.p>
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
