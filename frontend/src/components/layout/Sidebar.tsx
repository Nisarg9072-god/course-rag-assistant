import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Sparkles, BookOpen, Search, Info,
  GraduationCap, ChevronLeft, ChevronRight, X,
  Settings, Video, Plus, Loader2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { getCompletedCount } from '@/utils/storage';
import { useQuery } from '@tanstack/react-query';
import { getVideos } from '@/api/videos';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const NAV = [
  { to: '/',       icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ask',    icon: Sparkles,        label: 'Ask AI'    },
  { to: '/course', icon: BookOpen,        label: 'Course'    },
  { to: '/search', icon: Search,          label: 'Search'    },
  { to: '/about',  icon: Info,            label: 'About'     },
];

const INSTRUCTOR_NAV = [
  { to: '/admin',           icon: Settings, label: 'Dashboard'       },
  { to: '/admin/videos',    icon: Video,    label: 'Manage Videos'   },
  { to: '/admin/videos/add', icon: Plus,    label: 'Add Video'       },
  { to: '/admin/jobs',      icon: Loader2,  label: 'Processing Jobs' },
];

export function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const completedCount = getCompletedCount();
  const { data: videos = [] } = useQuery({ queryKey: ['videos'], queryFn: getVideos });
  const total = videos.length || 21;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const renderNav = (items: typeof NAV) => items.map(({ to, icon: Icon, label }) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/' || to === '/admin'}
      onClick={() => { if (window.innerWidth < 1024) onClose(); }}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
          'transition-all duration-150 group relative',
          isActive
            ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-slate-100',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={18} className={cn('shrink-0', isActive && 'text-brand-500')} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="whitespace-nowrap"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
          {collapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50">
              {label}
            </div>
          )}
        </>
      )}
    </NavLink>
  ));

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={cn(
          'fixed top-0 left-0 h-full z-40 flex flex-col',
          'bg-white dark:bg-[#111118]',
          'border-r border-slate-200 dark:border-white/[0.06]',
          'overflow-hidden select-none',
          // Mobile: slide in/out
          'transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-slate-100 dark:border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
              <GraduationCap size={16} className="text-white" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                  className="font-semibold text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap"
                >
                  Course RAG
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          {/* Close on mobile */}
          <button onClick={onClose} className="ml-auto lg:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {renderNav(NAV)}

          <AnimatePresence>
            {!collapsed && (
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
              >
                Instructor
              </motion.p>
            )}
          </AnimatePresence>
          {renderNav(INSTRUCTOR_NAV)}
        </nav>

        {/* Progress */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="px-4 py-4 border-t border-slate-100 dark:border-white/[0.06]"
            >
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-1.5 font-medium">Course Progress</p>
              <div className="h-1.5 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                  className="h-full bg-brand-500 rounded-full"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{completedCount} / {total} lessons · {pct}%</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex items-center justify-center h-10 border-t border-slate-100 dark:border-white/[0.06] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors shrink-0"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </motion.aside>
    </>
  );
}
