import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#09090b', // Deep zinc/charcoal
        surface: {
          50: '#27272a',
          100: '#18181b',
          200: '#121215',
          300: '#0e0e11',
        },
        border: {
          DEFAULT: '#27272a',
          subtle: '#1f1f23',
          strong: '#3f3f46',
        },
        primary: {
          DEFAULT: '#ffffff',
          foreground: '#09090b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        elevated: '0 4px 12px 0 rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
};

export default config;
