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
        brand: {
          50: '#f0fdf4',
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
        cruvels: {
          dark: '#0B0F17',
          card: '#131A29',
          cardBorder: '#1F293D',
          hover: '#1E293B',
          accent: '#3B82F6',
          accentHover: '#2563EB',
          emerald: '#10B981',
          gold: '#F59E0B',
          danger: '#EF4444',
          subtle: '#64748B',
          text: '#F8FAFC',
          muted: '#94A3B8'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glow': '0 0 20px rgba(59, 130, 246, 0.25)',
        'glow-emerald': '0 0 20px rgba(16, 185, 129, 0.25)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'subtle-grid': 'linear-gradient(to right, #1F293D15 1px, transparent 1px), linear-gradient(to bottom, #1F293D15 1px, transparent 1px)',
      }
    },
  },
  plugins: [],
};
export default config;
