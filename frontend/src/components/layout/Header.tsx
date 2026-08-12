import { useNavigate } from 'react-router-dom';
import { Search, Moon, Sun, Menu, GraduationCap } from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSidebar: () => void;
}

export function Header({ theme, onToggleTheme, onOpenSidebar }: HeaderProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  };

  return (
    <header className="h-16 flex items-center gap-3 px-4 lg:px-6 border-b border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-[#111118]/80 backdrop-blur-md sticky top-0 z-20">
      {/* Mobile menu */}
      <button
        onClick={onOpenSidebar}
        className="lg:hidden p-2 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Logo (mobile only) */}
      <div className="flex items-center gap-2 lg:hidden">
        <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center">
          <GraduationCap size={14} className="text-white" />
        </div>
        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">Course RAG</span>
      </div>

      {/* Global search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md hidden sm:block">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            type="text"
            placeholder="Search the course..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-white/[0.06] border border-transparent focus:border-brand-400 dark:focus:border-brand-500 focus:bg-white dark:focus:bg-white/[0.08] focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
          />
        </div>
      </form>

      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold cursor-pointer" aria-label="Profile">
          S
        </div>
      </div>
    </header>
  );
}
