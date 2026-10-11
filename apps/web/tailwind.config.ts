import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1280px',
      },
    },
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          // One accent, two jobs. Solid uses (`bg-primary`, `border-primary`,
          // `fill-primary`, a /50+ wash) get the lively tone - Cursor's
          // #7bafe9, Windsurf's #34e8bb - with a dark ink label. A faint tint
          // (`/5`…`/40`) is mixed from the deeper mid tone instead, because a
          // 10% wash of a pastel is indistinguishable from the card and every
          // selected row, active nav item and highlight would vanish.
          // A colour function is supported at runtime by Tailwind 3.4 (it is
          // called with the opacity, `var(--tw-bg-opacity)` for a solid use) but
          // is missing from its config types, hence the cast.
          DEFAULT: (({ opacityValue }: { opacityValue?: string }) => {
            if (opacityValue === undefined) return 'hsl(var(--primary))';
            const alpha = Number(opacityValue);
            if (Number.isNaN(alpha) || alpha >= 0.5) return `hsl(var(--primary) / ${opacityValue})`;
            return `hsl(var(--primary-mid) / ${opacityValue})`;
          }) as unknown as string,
          foreground: 'hsl(var(--primary-foreground))',
          accessible: 'hsl(var(--primary-accessible))',
        },
        /** Dark ink for a label on any lively mark (status chips, dots with text). */
        ink: 'hsl(var(--ink))',
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          accessible: 'hsl(var(--destructive-accessible))',
        },
        status: {
          success: {
            DEFAULT: 'hsl(var(--status-success-fg) / <alpha-value>)',
            bg: 'hsl(var(--status-success-bg) / <alpha-value>)',
            border: 'hsl(var(--status-success-border) / <alpha-value>)',
            mark: 'hsl(var(--status-success-mark) / <alpha-value>)',
          },
          warning: {
            DEFAULT: 'hsl(var(--status-warning-fg) / <alpha-value>)',
            bg: 'hsl(var(--status-warning-bg) / <alpha-value>)',
            border: 'hsl(var(--status-warning-border) / <alpha-value>)',
            mark: 'hsl(var(--status-warning-mark) / <alpha-value>)',
          },
          danger: {
            DEFAULT: 'hsl(var(--status-danger-fg) / <alpha-value>)',
            bg: 'hsl(var(--status-danger-bg) / <alpha-value>)',
            border: 'hsl(var(--status-danger-border) / <alpha-value>)',
            mark: 'hsl(var(--status-danger-mark) / <alpha-value>)',
          },
          info: {
            DEFAULT: 'hsl(var(--status-info-fg) / <alpha-value>)',
            bg: 'hsl(var(--status-info-bg) / <alpha-value>)',
            border: 'hsl(var(--status-info-border) / <alpha-value>)',
            mark: 'hsl(var(--status-info-mark) / <alpha-value>)',
          },
          accent: {
            DEFAULT: 'hsl(var(--status-accent-fg) / <alpha-value>)',
            bg: 'hsl(var(--status-accent-bg) / <alpha-value>)',
            border: 'hsl(var(--status-accent-border) / <alpha-value>)',
            mark: 'hsl(var(--status-accent-mark) / <alpha-value>)',
          },
          neutral: {
            DEFAULT: 'hsl(var(--status-neutral-fg) / <alpha-value>)',
            bg: 'hsl(var(--status-neutral-bg) / <alpha-value>)',
            border: 'hsl(var(--status-neutral-border) / <alpha-value>)',
            mark: 'hsl(var(--status-neutral-mark) / <alpha-value>)',
          },
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      // One token, one scale: the card corner is --radius (14px, globals.css)
      // and everything inside steps down from it, so an inner corner never
      // bulges past its container. Raised one notch from 12/8: at 8px a 32px
      // button read as a cut rectangle beside 12px cards; 10px reads as the
      // same family, softer, still clearly not a pill. Marks stay at 6px —
      // a checkbox at 10px stops looking like a checkbox. Only avatars, dots,
      // switches and progress tracks are fully round.
      borderRadius: {
        sm: 'calc(var(--radius) - 8px)',       //  6px  marks, kbd
        DEFAULT: 'calc(var(--radius) - 8px)',  //  6px  checkbox, tiny inline marks
        md: 'calc(var(--radius) - 4px)',       // 10px  buttons, fields, chips, badges
        lg: 'calc(var(--radius) - 4px)',       // 10px  menu items, tab triggers, rows
        xl: 'calc(var(--radius) - 2px)',       // 12px  tiles inside a card, menus
        '2xl': 'var(--radius)',                // 14px  cards, dialogs, sheets
        '3xl': 'calc(var(--radius) + 4px)',    // 18px  large marketing blocks, composer
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-out-right': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'slide-in-bottom': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-1deg)' },
          '50%': { transform: 'rotate(1deg)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out',
        'fade-in-up': 'fade-in-up 0.22s ease-out',
        'fade-in-down': 'fade-in-down 0.2s ease-out',
        'fade-in-left': 'fade-in-left 0.2s ease-out',
        'fade-in-right': 'fade-in-right 0.2s ease-out',
        'scale-in': 'scale-in 0.15s ease-out',
        'slide-in-right': 'slide-in-right 0.2s ease-out',
        'slide-out-right': 'slide-out-right 0.2s ease-out',
        'slide-in-bottom': 'slide-in-bottom 0.2s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
        'wiggle': 'wiggle 0.3s ease-in-out',
        'spin-slow': 'spin-slow 8s linear infinite',
      },
      // Elevation, cursor.com's way: nothing in the page flow casts a shadow.
      // A card, tile or button is separated by its surface step and a
      // hairline; a shadow under that hairline only draws a second edge.
      // So `sm`, `DEFAULT` and `md` -- the steps in-flow elements reach for --
      // are empty, and every one of the ~270 call sites goes quiet at once.
      //
      // `lg` and up are for what floats over the page (menus, popovers,
      // toasts, sheets, dialogs): one soft, wide, low-opacity spread, tinted
      // with `--shadow-color` and scaled by `--shadow-strength` so the dark
      // themes still register it. `flyout` names that intent for primitives.
      boxShadow: {
        sm: 'none',
        DEFAULT: 'none',
        md: 'none',
        lg: '0 4px 16px -4px hsl(var(--shadow-color) / calc(var(--shadow-strength) * 6%))',
        xl: '0 8px 24px -6px hsl(var(--shadow-color) / calc(var(--shadow-strength) * 8%))',
        '2xl': '0 12px 40px -8px hsl(var(--shadow-color) / calc(var(--shadow-strength) * 12%))',
        flyout: '0 4px 16px -4px hsl(var(--shadow-color) / calc(var(--shadow-strength) * 6%))',
        inner: 'none',
        none: 'none',
        'glow-sm': '0 4px 16px -4px hsl(var(--shadow-color) / calc(var(--shadow-strength) * 6%))',
        'glow-md': '0 8px 24px -6px hsl(var(--shadow-color) / calc(var(--shadow-strength) * 8%))',
      },
      // Flat on purpose: a glow behind the page or a card shifts the tone the
      // content sits on. The keys stay so existing call sites resolve.
      backgroundImage: {
        'hero-radial': 'none',
        'glass-sheen': 'none',
      },
      // Cursor.com steps at a 16px root. globals.css restates the same pixels
      // against the 82% desktop root so computed sizes match on every viewport.
      fontSize: {
        '2xs': ['0.765075rem', { lineHeight: '1rem' }], // 12.24px — captions, badges
        xs: ['0.82883125rem', { lineHeight: '1.25rem' }], // 13.26px
        sm: ['0.8925875rem', { lineHeight: '1.3125rem' }], // 14.28px
        base: ['1.0201rem', { lineHeight: '1.5rem' }], // 16.32px
        lg: ['1.125rem', { lineHeight: '1.625rem' }], // 18px
        xl: ['1.25rem', { lineHeight: '1.75rem' }], // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }], // 24px
        '3xl': ['1.625rem', { lineHeight: '2.03125rem' }], // 26px
        '4xl': ['2.25rem', { lineHeight: '2.7rem' }], // 36px
        '5xl': ['3rem', { lineHeight: '1' }], // 48px
        '6xl': ['3.75rem', { lineHeight: '1' }], // 60px
        '7xl': ['4.5rem', { lineHeight: '1' }], // 72px
      },
      fontFamily: {
        // Outer var = per-tenant override written by TenantContext.applyBrandingFonts;
        // inner var = self-hosted brand font injected by next/font in app/layout.tsx.
        // The tenant vars were previously written but never read, so custom
        // tenant fonts silently had no effect.
        sans: ['var(--font-sans, var(--font-inter))', 'system-ui', 'sans-serif'],
        display: ['var(--font-heading, var(--font-display-brand))', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        co: ['var(--font-co-mark)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        // Self-hosted by next/font in app/layout.tsx. The fallbacks matter: a
        // missing --font-mono used to land on the device's generic monospace,
        // which differs on every platform.
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      screens: {
        // Tall-and-narrow breakpoint used by the split-pane layouts.
        xs: '480px',
      },
    },
  },
  plugins: [animate],
};

export default config;
