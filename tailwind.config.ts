import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        core: {
          canvas: '#0b0e12',
          panel: '#11161c',
          raised: '#171d25',
          line: '#252d37',
          accent: '#1cc8ee',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
