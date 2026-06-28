import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:      { base:'#F8F5F0', surface:'#FFFFFF', elevated:'#FFFFFF', hover:'#F3EFE9', input:'#F8F5F0' },
        accent:  { DEFAULT:'#E85D04', light:'#F28C38', muted:'rgba(232, 93, 4, 0.08)' },
        border:  { DEFAULT:'#E9E3D8', accent:'#E85D04' },
        txt:     { primary:'#0F172A', secondary:'#475569', muted:'#94A3B8' },
        status:  { green:'#10B981', amber:'#F59E0B', red:'#EF4444', blue:'#3B82F6' },

        // Backward compatibility support for existing styles
        canvas: '#F8F5F0',
        surface: '#FFFFFF',
        elevated: '#FFFFFF',
        hover: '#F3EFE9',
        active: '#F3EFE9',
        input: '#F8F5F0',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
        tx1: '#0F172A',
        tx2: '#475569',
        tx3: '#94A3B8',
        'tx-accent': '#E85D04',
        'border-dim': '#E9E3D8',
        'border-base': '#E9E3D8',
        'border-loud': '#E85D04',
        student: '#E85D04',
        'student-light': '#F28C38',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        pill: '999px',
      },
      boxShadow: {
        sm: 'none',
        md: 'none',
        lg: 'none',
        focus: '0 0 0 3px rgba(232,93,4,0.30)',
      },
    },
  },
  plugins: [],
}

export default config
