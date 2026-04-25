/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Deep indigo — authoritative, premium financial aesthetic.
        // Matches the #4f46e5 already used in capacitor.config.ts and splash screen.
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // Financial gold — used for intrinsic value, DCF results, key numbers.
        gold: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Deep space surfaces — unchanged, already well-calibrated.
        surface: {
          950: '#07080f',
          900: '#0d0f18',
          800: '#12151f',
          700: '#181c28',
          600: '#1e2333',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.5), 0 1px 2px -1px rgba(0,0,0,0.5)',
        glow: '0 0 24px rgba(99,102,241,0.18)',
        'glow-gold': '0 0 20px rgba(251,191,36,0.12)',
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-468px 0' },
          '100%': { backgroundPosition: '468px 0' },
        },
      },
    },
  },
  plugins: [],
};
