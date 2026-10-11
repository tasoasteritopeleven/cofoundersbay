/**
 * Layout configuration for wider, more spacious UI at 100% zoom
 * Inspired by modern platforms like LinkedIn, Alliance theme
 */

export const layoutConfig = {
  // Container widths (20% wider than standard)
  maxWidth: {
    sm: '756px',    // Mobile landscape (+5%)
    md: '1008px',   // Tablet (+5%)
    lg: '1386px',   // Desktop (+5%)
    xl: '1638px',   // Large desktop (+5%)
    '2xl': '1890px', // Ultra-wide (+5%)
  },
  
  // Content area widths
  content: {
    narrow: '840px',   // For focused content (articles, forms) (+5%)
    standard: '1386px', // Standard content width (+5%)
    wide: '1638px',    // Wide layouts (dashboards, tables) (+5%)
    full: '100%',      // Full width
  },
  
  // Sidebar widths
  sidebar: {
    collapsed: '80px',
    expanded: '280px',  // Wider sidebar (was 240px)
  },
  
  // Navigation heights
  nav: {
    top: '72px',       // Taller top nav (was 64px)
    mobile: '64px',
  },
  
  // Spacing scale (more generous)
  spacing: {
    xs: '0.5rem',    // 8px
    sm: '0.75rem',   // 12px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
    '3xl': '4rem',   // 64px
    '4xl': '6rem',   // 96px
  },
  
  // Card dimensions
  card: {
    minHeight: '120px',
    padding: {
      sm: '1rem',
      md: '1.5rem',
      lg: '2rem',
    },
    gap: '1.5rem', // Gap between cards
  },
  
  // Grid configurations
  grid: {
    cols: {
      mobile: 1,
      tablet: 2,
      desktop: 3,
      wide: 4,
    },
    gap: {
      sm: '1rem',
      md: '1.5rem',
      lg: '2rem',
    },
  },
  
  // Font sizes (slightly larger for better readability)
  fontSize: {
    xs: '0.75rem',   // 12px
    sm: '0.875rem',  // 14px
    base: '1rem',    // 16px
    lg: '1.125rem',  // 18px
    xl: '1.25rem',   // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
  },
  
  // Breakpoints
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const;

export type LayoutConfig = typeof layoutConfig;

/** Full-width main column inside AppShell (sidebar offset is on the parent wrapper).
 *  Bottom padding accounts for the safe-area inset above the mobile bottom nav / home indicator.
 *  On lg+ it reserves room for the floating chat bubble (ChatBubble: 52px button + unread pill,
 *  anchored bottom-6 right-6) so the last row of content is never hidden behind it. */
/**
 * The desktop gutter is 1.2rem (15.7px at the 82% root), down from 2rem/2.5rem.
 *
 * The column already used 100% of the width the sidebar leaves — measured 0px
 * unused at every desktop width — so a further 2% could only come out of the
 * gutter itself. 1.2rem is the value that lands nearest +2% across the range:
 * +2.0% at 1280 and 1920, +2.3% at 1725, +1.7% at 1440, +1.5% at 2560. Below
 * `lg` the phone and tablet gutters are untouched.
 */
export const appShellMainClasses =
  'focus:outline-none flex-1 w-full min-w-0 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-[calc(10rem+env(safe-area-inset-bottom,0px))] sm:pb-28';

/** Loading skeleton wrapper — mirrors AppShell main padding without a max-width cap. */
export const appShellLoadingClasses =
  'mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-5';
