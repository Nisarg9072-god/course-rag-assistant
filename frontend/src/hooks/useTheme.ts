import { useState, useEffect } from 'react';
import { getSavedTheme, saveTheme } from '@/utils/storage';

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getSavedTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return { theme, toggleTheme };
}
