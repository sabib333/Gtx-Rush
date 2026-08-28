import type { Config } from 'tailwindcss';

/**
 * GTX Rush Design Token System
 *
 * All design decisions are centralized here.
 * Components reference these tokens, not hardcoded values.
 *
 * Color philosophy: Layered dark surfaces with vibrant accent colors.
 * Not pure black — use slate/gray with blue/purple accents for depth.
 */

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // === COLOR TOKENS ===
      colors: {
        // Core surfaces (layered dark theme)
        surface: {
          base: '#0c1222',      // Deepest background
          raised: '#131c2e',    // Cards, elevated panels
          overlay: '#1a2540',   // Modals, dropdowns
          border: '#243049',    // Subtle borders
          hover: '#1e2d48',     // Hover states
        },

        // Brand accent — electric blue
        accent: {
          50: '#eef4ff',
          100: '#d9e5ff',
          200: '#bcd0ff',
          300: '#8eb3ff',
          400: '#5988ff',
          500: '#3366ff',    // Primary accent
          600: '#1a44f5',
          700: '#1332e1',
          800: '#162ab6',
          900: '#182a8f',
          DEFAULT: '#3366ff',
        },

        // Energetic accent — electric purple
        energy: {
          400: '#b07aff',
          500: '#9050ff',
          600: '#7030e0',
          DEFAULT: '#9050ff',
        },

        // Status colors
        success: {
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          DEFAULT: '#22c55e',
        },
        warning: {
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          DEFAULT: '#eab308',
        },
        danger: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          DEFAULT: '#ef4444',
        },

        // Text hierarchy
        txt: {
          primary: '#f1f5f9',    // Main text
          secondary: '#94a3b8',  // Subtitles, descriptions
          tertiary: '#64748b',   // Hints, placeholders
          muted: '#475569',      // Disabled text
        },

        // Game-specific colors
        game: {
          reaction: '#ef4444',   // Red — reaction
          tap: '#22c55e',        // Green — tap
          quiz: '#a855f7',       // Purple — quiz
        },

        // Rank/rarity
        rank: {
          gold: '#fbbf24',
          silver: '#9ca3af',
          bronze: '#d97706',
        },

        rarity: {
          common: '#94a3b8',
          rare: '#3b82f6',
          epic: '#a855f7',
          legendary: '#f59e0b',
        },
      },

      // === TYPOGRAPHY TOKENS ===
      fontFamily: {
        display: ['"SF Pro Display"', '"Inter"', 'system-ui', 'sans-serif'],
        body: ['"SF Pro Text"', '"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', '"Fira Code"', 'monospace'],
        score: ['"SF Pro Display"', '"Inter"', '"DIN Alternate"', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        // Display — hero moments
        'display-xl': ['3rem', { lineHeight: '1.1', fontWeight: '900', letterSpacing: '-0.02em' }],
        'display-lg': ['2.25rem', { lineHeight: '1.15', fontWeight: '800', letterSpacing: '-0.02em' }],
        'display': ['1.875rem', { lineHeight: '1.2', fontWeight: '800', letterSpacing: '-0.01em' }],

        // Headings
        'h1': ['1.5rem', { lineHeight: '1.3', fontWeight: '700' }],
        'h2': ['1.25rem', { lineHeight: '1.35', fontWeight: '700' }],
        'h3': ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],

        // Body
        'body-lg': ['1rem', { lineHeight: '1.5', fontWeight: '400' }],
        'body': ['0.9375rem', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.5', fontWeight: '400' }],

        // Caption
        'caption': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
        'caption-xs': ['0.6875rem', { lineHeight: '1.3', fontWeight: '500' }],

        // Button
        'btn-lg': ['1rem', { lineHeight: '1', fontWeight: '600' }],
        'btn': ['0.9375rem', { lineHeight: '1', fontWeight: '600' }],
        'btn-sm': ['0.8125rem', { lineHeight: '1', fontWeight: '600' }],

        // Score — big, bold, impactful
        'score-xl': ['3.5rem', { lineHeight: '1', fontWeight: '900', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }],
        'score-lg': ['2.5rem', { lineHeight: '1', fontWeight: '900', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }],
        'score': ['1.75rem', { lineHeight: '1', fontWeight: '800', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }],
        'score-sm': ['1.25rem', { lineHeight: '1', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }],

        // Rank
        'rank-xl': ['2rem', { lineHeight: '1', fontWeight: '900', fontVariantNumeric: 'tabular-nums' }],
        'rank': ['1.125rem', { lineHeight: '1', fontWeight: '800', fontVariantNumeric: 'tabular-nums' }],
      },

      // === SPACING TOKENS ===
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-top': 'env(safe-area-inset-top, 0px)',
      },

      // === BORDER RADIUS TOKENS ===
      borderRadius: {
        'sm': '0.375rem',
        'md': '0.625rem',
        'lg': '0.875rem',
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        'pill': '9999px',
      },

      // === SHADOW TOKENS ===
      boxShadow: {
        'glow-sm': '0 0 10px -2px rgba(51, 102, 255, 0.3)',
        'glow': '0 0 20px -4px rgba(51, 102, 255, 0.4)',
        'glow-lg': '0 0 30px -6px rgba(51, 102, 255, 0.5)',
        'glow-purple': '0 0 20px -4px rgba(144, 80, 255, 0.4)',
        'glow-green': '0 0 20px -4px rgba(34, 197, 94, 0.4)',
        'glow-red': '0 0 20px -4px rgba(239, 68, 68, 0.4)',
        'card': '0 2px 8px -2px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 4px 16px -4px rgba(0, 0, 0, 0.5)',
        'elevated': '0 8px 32px -8px rgba(0, 0, 0, 0.6)',
      },

      // === MOTION TOKENS ===
      transitionDuration: {
        'fast': '100ms',
        'normal': '200ms',
        'slow': '350ms',
        'slower': '500ms',
      },

      transitionTimingFunction: {
        'ease-out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
        'ease-in-out-expo': 'cubic-bezier(0.87, 0, 0.13, 1)',
        'ease-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      // === ANIMATION TOKENS ===
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.19, 1, 0.22, 1)',
        'slide-down': 'slideDown 0.4s cubic-bezier(0.19, 1, 0.22, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pop': 'pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'score-count': 'scoreCount 0.6s cubic-bezier(0.19, 1, 0.22, 1)',
        'shimmer': 'shimmer 1.5s infinite',
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'spin-slow': 'spin 3s linear infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 15px -3px rgba(51, 102, 255, 0.3)' },
          '50%': { boxShadow: '0 0 25px -3px rgba(51, 102, 255, 0.6)' },
        },
        scoreCount: {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.95)' },
          '60%': { opacity: '1', transform: 'translateY(-2px) scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },

      // === BACKGROUND GRADIENTS ===
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #3366ff 0%, #9050ff 100%)',
        'gradient-brand-sm': 'linear-gradient(135deg, #3366ff 0%, #7030e0 100%)',
        'gradient-card': 'linear-gradient(145deg, rgba(26, 37, 64, 0.8) 0%, rgba(19, 28, 46, 0.9) 100%)',
        'gradient-challenge': 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)',
        'gradient-surface': 'linear-gradient(180deg, #131c2e 0%, #0c1222 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
