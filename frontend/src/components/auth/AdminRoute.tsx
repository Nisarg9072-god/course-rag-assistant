import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { checkAdminSession, isAdminAuthenticated } from '@/api/auth';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [checked, setChecked] = useState(isAdminAuthenticated());
  const [authed, setAuthed] = useState(isAdminAuthenticated());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await checkAdminSession();
      if (!cancelled) {
        setAuthed(ok);
        setChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!checked) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
