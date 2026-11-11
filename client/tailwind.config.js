/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cf: {
          bg: '#080D2B',
          navy: '#070B24',
          secondary: '#0B1538',
          sidebar: '#0C173D',
          card: '#101D45',
          elevated: '#162653',
          border: '#263968',
          red: '#E62429',
          crimson: '#B5121B',
          royal: '#1476D4',
          cyan: '#38DFFF',
          ice: '#B8F5FF',
          violet: '#8247E5',
          text: '#F4F7FF',
          muted: '#A7B4D2',
          faint: '#7381A8',
          success: '#35D58A',
          warning: '#FFBD45',
          error: '#FF525E',
        },
        // Aliases for gradual migration from scaffold class names
        brand: {
          400: '#E62429',
          500: '#E62429',
          600: '#B5121B',
          300: '#FF525E',
        },
        surface: {
          0: '#080D2B',
          1: '#0C173D',
          2: '#0B1538',
          3: '#101D45',
          4: '#263968',
          5: '#162653',
        },
        cyan: {
          400: '#38DFFF',
          500: '#38DFFF',
        },
        violet: {
          400: '#8247E5',
          500: '#8247E5',
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        display: ['Silkscreen', 'cursive'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(56, 223, 255, 0.25)',
        'glow-red': '0 0 18px rgba(230, 36, 41, 0.28)',
        'glow-violet': '0 0 22px rgba(130, 71, 229, 0.22)',
        panel: '0 8px 32px rgba(0, 0, 0, 0.35)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand': 'linear-gradient(135deg, #E62429 0%, #1476D4 100%)',
        'gradient-hero':
          'radial-gradient(ellipse at 20% 0%, rgba(230,36,41,0.18), transparent 50%), radial-gradient(ellipse at 80% 10%, rgba(56,223,255,0.12), transparent 45%), radial-gradient(ellipse at 50% 100%, rgba(130,71,229,0.12), transparent 55%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
