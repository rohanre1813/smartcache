/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#070b14',
        card: '#0b1120',
        primary: '#3b82f6',
        'primary-dark': '#2563eb',
        'muted-text': '#94a3b8',
        foreground: '#f1f5f9',
        border: 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      boxShadow: {
        'glow-blue': '0 0 25px rgba(59,130,246,0.15)',
        'glow-blue-lg': '0 0 50px rgba(59,130,246,0.2)',
        'glow-emerald': '0 0 20px rgba(16,185,129,0.15)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 10px rgba(59,130,246,0.4)' },
          '50%': { opacity: '0.7', boxShadow: '0 0 25px rgba(59,130,246,0.7)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backdropBlur: {
        md: '12px',
      },
    },
  },
  plugins: [],
}
