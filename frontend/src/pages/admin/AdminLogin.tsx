import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { adminLogin } from '@/api/auth';
import { ApiError } from '@/api/client';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminLogin(password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid password. Check ADMIN_PASSWORD in backend/.env matches what you entered.');
      } else if (err instanceof Error && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        setError('Cannot reach the backend. Make sure python backend/api.py is running.');
      } else {
        setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <div className="max-w-sm mx-auto px-4 py-16">
        <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#18181f] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Lock size={20} className="text-brand-500" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Instructor Login</h1>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Admin access is required to upload, delete, or manage course videos.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-transparent text-sm"
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </PageContainer>
  );
}
