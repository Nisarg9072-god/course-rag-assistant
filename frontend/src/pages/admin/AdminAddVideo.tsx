import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Upload, Video, ArrowLeft, Loader2 } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { uploadVideo, addVideoSource } from '@/api/admin';
import { cn } from '@/utils/cn';

type Tab = 'upload' | 'youtube';

export default function AdminAddVideo() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [number, setNumber] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [error, setError] = useState('');

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (tab === 'upload') {
        if (!file) throw new Error('Choose an MP4 file');
        return uploadVideo(file, title.trim(), parseInt(number, 10));
      }
      return addVideoSource(youtubeUrl.trim(), title.trim(), parseInt(number, 10));
    },
    onSuccess: (data) => {
      navigate(`/admin/jobs?job=${data.job_id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const n = parseInt(number, 10);
    if (!title.trim()) { setError('Title is required'); return; }
    if (!number || Number.isNaN(n) || n < 1) { setError('Valid video number is required'); return; }
    if (tab === 'upload' && !file) { setError('Choose an MP4 file'); return; }
    if (tab === 'youtube' && !youtubeUrl.trim()) { setError('YouTube URL is required'); return; }
    uploadMutation.mutate();
  };

  return (
    <PageContainer>
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 mb-6"
        >
          <ArrowLeft size={16} /> Back to dashboard
        </button>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
          Add Course Video
        </h1>

        <div className="flex gap-2 mb-6 p-1 rounded-xl bg-slate-100 dark:bg-white/[0.04]">
          {(['upload', 'youtube'] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors',
                tab === t
                  ? 'bg-white dark:bg-[#18181f] text-brand-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {t === 'upload' ? <Upload size={16} /> : <Video size={16} />}
              {t === 'upload' ? 'Upload Video' : 'YouTube Source'}
            </button>
          ))}
        </div>

        <motion.form
          key={tab}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          onSubmit={handleSubmit}
          className="space-y-4 p-6 rounded-xl bg-white dark:bg-[#18181f] border border-slate-200 dark:border-white/[0.06]"
        >
          {tab === 'upload' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">MP4 File</label>
              <input
                type="file"
                accept="video/mp4,.mp4"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">YouTube URL</label>
              <input
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-transparent text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="CSS Positioning"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Video Number</label>
            <input
              value={number}
              onChange={e => setNumber(e.target.value)}
              placeholder="19"
              type="number"
              min={1}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-transparent text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={uploadMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold"
          >
            {uploadMutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Starting...</>
            ) : (
              'Start Processing'
            )}
          </button>
        </motion.form>
      </div>
    </PageContainer>
  );
}
