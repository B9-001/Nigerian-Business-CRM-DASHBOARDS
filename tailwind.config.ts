import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          dark: 'var(--primary-dark)',
          soft: 'var(--primary-soft)',
          hover: 'var(--primary-hover)',
          foreground: '#FFFFFF',
        },
        background: 'var(--background)',
        surface: {
          DEFAULT: 'var(--surface)',
          muted: 'var(--surface-muted)',
        },
        foreground: 'var(--text-primary)',
        'muted-foreground': 'var(--text-secondary)',
        subtle: 'var(--text-muted)',
        border: 'var(--border)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
      },
      borderRadius: {
        card: '18px',
        control: '11px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(17, 24, 23, 0.04), 0 8px 24px rgba(17, 24, 23, 0.06)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
    },
  },
  plugins: [],
}

export default config
