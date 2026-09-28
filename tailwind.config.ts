import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07090f',
          900: '#0b0e17',
          850: '#101423',
          800: '#151a2e',
          700: '#1e2440',
          600: '#2a3157',
        },
        up: '#22c55e',
        down: '#ef4444',
        accent: '#8b5cf6',
        accent2: '#22d3ee',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
