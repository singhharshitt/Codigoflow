/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cf: {
          bg: '#0B0E15',
          navy: '#080A10',
          secondary: '#0E121A',
          sidebar: '#0A0D13',
          card: '#11151F',
          elevated: '#1A1F2A',
          border: '#232937',
          red: '#E62429',
          crimson: '#B5121B',
          royal: '#4C8DF6',
          cyan: '#5DC4DF',
          ice: '#D6ECF3',
          violet: '#9AA3B5',
          text: '#ECEEF3',
          muted: '#A3A9B8',
          faint: '#7D8598',
          success: '#4CC38A',
          warning: '#E8B44C',
          error: '#E5484D',
        },
        // Aliases for gradual migration from scaffold class names
        brand: {
          400: '#E62429',
          500: '#E62429',
          600: '#B5121B',
          300: '#E5484D',
        },
        surface: {
          0: '#0B0E15',
          1: '#0A0D13',
          2: '#0E121A',
          3: '#11151F',
          4: '#232937',
          5: '#1A1F2A',
        },
        cyan: {
          400: '#5DC4DF',
          500: '#5DC4DF',
        },
        violet: {
          400: '#9AA3B5',
          500: '#9AA3B5',
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': 'none',
        'glow-red': 'none',
        'glow-violet': 'none',
        panel: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand': 'linear-gradient(#E62429, #E62429)',
        'gradient-hero': 'none',
      },
      transitionTimingFunction: {
        cf: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-in': 'slideIn 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-8px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
