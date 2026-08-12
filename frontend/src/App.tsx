import { useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useTheme } from '@/hooks/useTheme';
import Dashboard from '@/pages/Dashboard';
import AskAI from '@/pages/AskAI';
import Course from '@/pages/Course';
import VideoPage from '@/pages/VideoPlayer';
import Search from '@/pages/Search';
import About from '@/pages/About';

// ── Inner layout (needs useLocation) ─────────────────────────────────────────
function AppShell() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Chat page needs a fixed-height, non-scrolling layout
  const isChat = location.pathname === '/ask';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-[#0a0a0f]">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />

      {/* ── Main column (shifts right on desktop to clear the sidebar) ───── */}
      {/*
        On large screens the sidebar is 240px expanded or 64px collapsed.
        We use a CSS custom-property trick: the sidebar sets --sidebar-w via
        its own animated width. Here we just replicate the same two values.
      */}
      <div
        className={[
          'flex flex-col flex-1 min-w-0 transition-[margin] duration-200',
          // Desktop: push content right by sidebar width
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-60',
        ].join(' ')}
      >
        {/* Header */}
        <Header
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        {/* Page area */}
        <div
          className={[
            'flex-1 min-h-0',
            isChat
              ? 'flex flex-col overflow-hidden'
              : 'overflow-y-auto',
          ].join(' ')}
        >
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/"               element={<Dashboard />} />
              <Route path="/ask"            element={<AskAI />} />
              <Route path="/course"         element={<Course />} />
              <Route path="/course/:videoId" element={<VideoPage />} />
              <Route path="/search"         element={<Search />} />
              <Route path="/about"          element={<About />} />
            </Routes>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
