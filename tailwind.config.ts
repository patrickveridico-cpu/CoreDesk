import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        core: {
          canvas: 'rgb(var(--core-canvas) / <alpha-value>)',
          panel: 'rgb(var(--core-surface) / <alpha-value>)',
          raised: 'rgb(var(--core-surface-elevated) / <alpha-value>)',
          line: 'rgb(var(--core-border) / <alpha-value>)',
          accent: 'rgb(var(--core-accent) / <alpha-value>)',
          'accent-hover': 'rgb(var(--core-accent-hover) / <alpha-value>)',
          'accent-active': 'rgb(var(--core-accent-active) / <alpha-value>)',
          text: 'rgb(var(--core-text-primary) / <alpha-value>)',
          muted: 'rgb(var(--core-text-secondary) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
