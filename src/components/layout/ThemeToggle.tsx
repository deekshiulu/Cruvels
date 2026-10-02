'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      id="theme-toggle"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="
        relative flex items-center justify-center
        h-10 w-10 sm:h-9 sm:w-9 rounded-xl
        border border-[var(--line)]
        bg-[var(--surface)]
        text-[var(--muted)]
        hover:text-[var(--ink)]
        hover:bg-[var(--surface-hover)]
        transition-all duration-150
        touch-manipulation cursor-pointer
        active:scale-95
        shadow-none
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]
      "
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
