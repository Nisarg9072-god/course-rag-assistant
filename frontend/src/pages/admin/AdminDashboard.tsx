import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Video, Plus, Loader2, CheckCircle2, AlertCircle, Layers, ListTodo,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { getAdminStats } from '@/api/admin';
import { getStats } from '@/api/videos';

export default function AdminDashboard() {
  const { data: admin } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: getAdminStats,
  });
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  const cards = [
    { label: 'Total Videos', value: admin?.totalVideos ?? '—', icon: Video, color: 'text-brand-500' },
    { label: 'Ready', value: admin?.readyVideos ?? '—', icon: CheckCircle2, color: 'text-emerald-500' },
    { label: 'Processing', value: admin?.processingVideos ?? '—', icon: Loader2, color: 'text-amber-500' },
    { label: 'Failed', value: admin?.failedVideos ?? '—', icon: AlertCircle, color: 'text-red-500' },
    { label: 'Transcript Chunks', value: admin?.totalChunks?.toLocaleString() ?? stats?.totalChunks?.toLocaleString() ?? '—', icon: Layers, color: 'text-purple-500' },
    { label: 'Indexed (Vector DB)', value: stats?.indexedChunks?.toLocaleString() ?? '—', icon: Layers, color: 'text-indigo-500' },
  ];

  const indexedPct = admin && admin.totalVideos > 0
    ? Math.round((admin.readyVideos / admin.totalVideos) * 100)
    : 100;

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
            Instructor Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage course content and monitor AI processing
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {cards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-5 rounded-xl bg-white dark:bg-[#18181f] border border-slate-200 dark:border-white/[0.06]"
            >
              <c.icon size={20} className={`${c.color} mb-3`} />
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{c.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{c.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#18181f] border border-slate-200 dark:border-white/[0.06] mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-600 dark:text-slate-400">Indexed Content</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{indexedPct}%</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-emerald-500 rounded-full transition-all"
              style={{ width: `${indexedPct}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/admin/videos/add"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
          >
            <Plus size={18} /> Add Video
          </Link>
          <Link
            to="/admin/jobs"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 dark:border-white/[0.08] text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/[0.04]"
          >
            <ListTodo size={18} /> Processing Jobs
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
