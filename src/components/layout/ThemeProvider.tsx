'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // Read stored preference, fall back to OS preference, then light
    const stored = localStorage.getItem('cruvels-theme') as Theme | null;
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
      applyTheme(stored);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial: Theme = prefersDark ? 'dark' : 'light';
      setTheme(initial);
      applyTheme(initial);
    }
  }, []);

  const applyTheme = (t: Theme) => {
    const html = document.documentElement;
    if (t === 'dark') {
      html.classList.add('dark');
      html.setAttribute('data-theme', 'dark');
    } else {
      html.classList.remove('dark');
      html.setAttribute('data-theme', 'light');
    }
    // Persist to both localStorage and a 1-year cookie (survives logout)
    localStorage.setItem('cruvels-theme', t);
    document.cookie = `cruvels-theme=${t}; path=/; max-age=31536000; SameSite=Lax`;
  };

  const toggle = () => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
