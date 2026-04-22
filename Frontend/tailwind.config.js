/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A3C6E',
          light:   '#2D5AA0',
          dark:    '#0F2548',
        },
        accent: {
          DEFAULT: '#F97316',
          light:   '#FB923C',
          dark:    '#EA6C00',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          alt:     '#F1F5F9',
          dark:    '#1E293B',
        },
        bg: '#0F172A',
        success: '#22C55E',
        warning: '#F59E0B',
        danger:  '#EF4444',
        border:  '#E2E8F0',
      },
      fontFamily: {
        heading: ['Syne', 'sans-serif'],
        body:    ['DM Sans', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        sm:      '0 2px 8px rgba(0,0,0,0.06)',
        md:      '0 4px 20px rgba(0,0,0,0.10)',
        lg:      '0 8px 40px rgba(0,0,0,0.16)',
        xl:      '0 20px 60px rgba(0,0,0,0.20)',
        accent:  '0 8px 30px rgba(249,115,22,0.35)',
        primary: '0 8px 30px rgba(26,60,110,0.35)',
      },
      borderRadius: {
        xs:   '6px',
        sm:   '10px',
        md:   '16px',
        lg:   '24px',
        xl:   '32px',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #1A3C6E 0%, #2D5AA0 100%)',
        'gradient-accent':  'linear-gradient(135deg, #F97316 0%, #FBBF24 100%)',
        'gradient-hero':    'linear-gradient(135deg, rgba(15,37,72,0.93) 0%, rgba(26,60,110,0.82) 50%, rgba(249,115,22,0.15) 100%)',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
