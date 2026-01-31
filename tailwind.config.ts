import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Core dark theme
        steel: {
          50: '#f7f8f8',
          100: '#edeef1',
          200: '#d8dbdf',
          300: '#b5bac3',
          400: '#8d95a1',
          500: '#6e7785',
          600: '#59606d',
          700: '#494e59',
          800: '#3f434c',
          900: '#383b42',
          950: '#25272c',
        },
        carbon: {
          50: '#f6f6f6',
          100: '#e7e7e7',
          200: '#d1d1d1',
          300: '#b0b0b0',
          400: '#888888',
          500: '#6d6d6d',
          600: '#5d5d5d',
          700: '#4f4f4f',
          800: '#454545',
          900: '#3d3d3d',
          950: '#1a1a1a',
        },
        surface: {
          DEFAULT: '#0a0a0b',
          raised: '#111113',
          overlay: '#18181b',
          elevated: '#1f1f23',
          highlight: '#27272b',
        },
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#60a5fa',
          muted: '#1e40af',
          cyan: '#06b6d4',
          emerald: '#10b981',
          rose: '#f43f5e',
        },
        border: {
          DEFAULT: '#27272a',
          subtle: '#1f1f23',
          focus: '#3b82f6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-steel': 'linear-gradient(135deg, #0a0a0b 0%, #18181b 50%, #0a0a0b 100%)',
        'gradient-accent': 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
        'gradient-glow': 'radial-gradient(circle at center, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(59, 130, 246, 0.3)',
        'glow-lg': '0 0 40px rgba(59, 130, 246, 0.4)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'wave': 'wave 1s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'slide-in': 'slideIn 0.4s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(59, 130, 246, 0.5)' },
        },
        wave: {
          '0%, 100%': { transform: 'scaleY(0.5)' },
          '50%': { transform: 'scaleY(1)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-10px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
