import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cruvels Workplace OS — design tokens (mirrors CSS custom properties)
        cruvels: {
          ink:     '#0A192F',
          paper:   '#F0F4F8',
          surface: '#FFFFFF',
          teal:    '#0A369D',
          amber:   '#D97706',
          line:    '#D0DCE8',
          muted:   '#5C768D',
          // Dark-mode surfaces
          'dark-bg':      '#070E1A',
          'dark-surface': '#0D192B',
          'dark-line':    '#1A2F4C',
          'dark-muted':   '#7E95AD',
        },
        // Keep brand green for leave/status indicators
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
      },
      fontFamily: {
        bricolage: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        archivo:   ['Archivo', 'system-ui', 'sans-serif'],
        sans:      ['Archivo', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        // Rule-based depth — no glow soup
        'rule': '0 1px 0 var(--line)',
        'panel': '0 2px 8px -2px rgba(18,32,42,0.08)',
      },
    },
  },
  plugins: [],
};
export default config;
