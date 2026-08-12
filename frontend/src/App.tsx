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
import { AdminRoute } from '@/components/auth/AdminRoute';
import { useTheme } from '@/hooks/useTheme';
import Dashboard from '@/pages/Dashboard';
import AskAI from '@/pages/AskAI';
import Course from '@/pages/Course';
import VideoPage from '@/pages/VideoPlayer';
import Search from '@/pages/Search';
import About from '@/pages/About';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminVideos from '@/pages/admin/AdminVideos';
import AdminAddVideo from '@/pages/admin/AdminAddVideo';
import AdminJobs from '@/pages/admin/AdminJobs';
import AdminVideoDetail from '@/pages/admin/AdminVideoDetail';
import AdminLogin from '@/pages/admin/AdminLogin';

// ── Inner layout (needs useLocation) ─────────────────────────────────────────
function AppShell() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Chat page needs a fixed-height, non-scrolling layout
  const isChat = location.pathname === '/ask';
  const isLogin = location.pathname === '/admin/login';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-[#0a0a0f]">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      {!isLogin && (
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(c => !c)}
        />
      )}

      {/* ── Main column (shifts right on desktop to clear the sidebar) ───── */}
      <div
        className={[
          'flex flex-col flex-1 min-w-0 transition-[margin] duration-200',
          !isLogin && (sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-60'),
        ].join(' ')}
      >
        {/* Header */}
        {!isLogin && (
          <Header
            theme={theme}
            onToggleTheme={toggleTheme}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        )}

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
              <Route path="/admin/login"    element={<AdminLogin />} />
              <Route path="/admin"              element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/videos"       element={<AdminRoute><AdminVideos /></AdminRoute>} />
              <Route path="/admin/videos/add"    element={<AdminRoute><AdminAddVideo /></AdminRoute>} />
              <Route path="/admin/videos/:videoId" element={<AdminRoute><AdminVideoDetail /></AdminRoute>} />
              <Route path="/admin/jobs"          element={<AdminRoute><AdminJobs /></AdminRoute>} />
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
