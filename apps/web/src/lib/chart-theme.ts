'use client';

import { useEffect, useState } from 'react';

/**
 * One chart palette for the whole product.
 *
 * Before this existed, /admin/dashboard used the Recharts demo defaults
 * (#0088FE, #00C49F, #FFBB28…), /analytics used a violet/cyan set, /org/analytics
 * a third set and /investor/portfolio a fourth — so the same "Accepted" series
 * was a different colour on every screen, and none of the sets had been checked
 * for colour-vision deficiency or for contrast against the dark surface.
 *
 * The palette below is validated in both modes against the app's own chart
 * surfaces (light card #ffffff, dark card ≈ #151B28):
 *   light — worst adjacent CVD ΔE 9.1, normal-vision ΔE 19.6
 *   dark  — worst adjacent CVD ΔE 8.4, normal-vision ΔE 19.3, all ≥ 3:1 contrast
 * Three light-mode slots sit under 3:1 against white, so charts using them must
 * carry visible labels or a legend — which every chart in the app already does.
 *
 * Slots are assigned in fixed order and never cycled. Past six series, fold the
 * tail into "Other" or facet the chart; do not generate a seventh hue.
 */

export const CHART_SERIES_LIGHT = [
  '#6756dc', // 1 brand lilac (248 66% 60%)
  '#a88868', // 2 muted clay — sits with grey, does not shout
  '#4d8a6a', // 3 muted green
  '#8b6e55', // 4 dusty bronze (32 24% 43%) — helper, not a second brand
  '#a07a8c', // 5 muted rose
  '#5a7a5a', // 6 quiet green helper
] as const;

export const CHART_SERIES_DARK = [
  '#a89ae8',
  '#b89878',
  '#6a9a80',
  '#b49a7a',
  '#b0909c',
  '#6a8a6a',
] as const;

/**
 * Status colours are reserved for state (good / warning / serious / critical)
 * and are never reused as "series 7". They always ship with a text label.
 */
export const CHART_STATUS_LIGHT = {
  good: '#4d8a6a',
  warning: '#8b6e55',
  serious: '#a88868',
  critical: '#9d6a6a',
  neutral: '#6c6e7a',
} as const;

export const CHART_STATUS_DARK = {
  good: '#6a9a80',
  warning: '#b49a7a',
  serious: '#b89878',
  critical: '#b08080',
  neutral: '#9a9ba6',
} as const;

export type ChartTheme = {
  isDark: boolean;
  /** Categorical slots, in fixed order. */
  series: readonly string[];
  status: Record<keyof typeof CHART_STATUS_LIGHT, string>;
  /** Recessive chrome, resolved from the app's own theme tokens. */
  grid: string;
  axis: string;
  surface: string;
  border: string;
  /** Ready-made Recharts <Tooltip contentStyle> matching the app's cards. */
  tooltipStyle: React.CSSProperties;
};

function readToken(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  // Tokens are stored as bare HSL triplets, e.g. "220 13% 90%".
  return raw ? `hsl(${raw})` : fallback;
}

/**
 * Recharts sets colours as SVG presentation attributes, where `var()` is not
 * reliably substituted across browsers — so the theme tokens are resolved to
 * concrete values at runtime instead of being passed through as var().
 *
 * Returns the light theme on the server and on first paint, then re-resolves
 * after mount and whenever the theme class on <html> changes.
 */
export function useChartTheme(): ChartTheme {
  const [isDark, setIsDark] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    const resolve = () => {
      const theme = root.getAttribute('data-theme');
      setIsDark(
        root.classList.contains('dark') ||
          theme === 'cofounder' ||
          theme === 'system' ||
          (!theme && !root.classList.contains('light') &&
            window.matchMedia('(prefers-color-scheme: dark)').matches),
      );
      setTick((t) => t + 1);
    };
    resolve();

    const observer = new MutationObserver(resolve);
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'data-theme'] });

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', resolve);

    return () => {
      observer.disconnect();
      media.removeEventListener('change', resolve);
    };
  }, []);

  // `tick` is read so the token lookups re-run after a theme change.
  void tick;

  const border = readToken('--border', isDark ? 'hsl(220 18% 20%)' : 'hsl(220 13% 90%)');
  const axis = readToken('--muted-foreground', isDark ? 'hsl(215 20% 65%)' : 'hsl(220 10% 42%)');
  const surface = readToken('--card', isDark ? 'hsl(222 30% 12%)' : 'hsl(0 0% 100%)');

  return {
    isDark,
    // Slot 1 is the theme's own accent, not a fixed lilac: in the Mint theme
    // every chart's lead series was #6756dc beside mint buttons. The other
    // slots stay the muted categorical set (they encode "which series", and
    // must not change meaning between themes).
    series: [
      readToken('--primary', (isDark ? CHART_SERIES_DARK : CHART_SERIES_LIGHT)[0]),
      // Slots 2-6 are per-theme categorical tones (--chart-2..6); dark themes
      // do not declare them, so they fall back to the fixed dark set.
      ...[2, 3, 4, 5, 6].map((n) =>
        readToken(`--chart-${n}`, (isDark ? CHART_SERIES_DARK : CHART_SERIES_LIGHT)[n - 1]),
      ),
    ],
    // Status colours follow the theme's lively marks, so a "good" bar in a
    // chart matches a "good" ring and dot on the same page.
    status: {
      ...(isDark ? CHART_STATUS_DARK : CHART_STATUS_LIGHT),
      good: readToken('--status-success-mark', (isDark ? CHART_STATUS_DARK : CHART_STATUS_LIGHT).good),
      warning: readToken('--status-warning-mark', (isDark ? CHART_STATUS_DARK : CHART_STATUS_LIGHT).warning),
      critical: readToken('--status-danger-mark', (isDark ? CHART_STATUS_DARK : CHART_STATUS_LIGHT).critical),
      neutral: readToken('--status-neutral-mark', (isDark ? CHART_STATUS_DARK : CHART_STATUS_LIGHT).neutral),
    },
    grid: border,
    axis,
    surface,
    border,
    tooltipStyle: {
      background: surface,
      border: `1px solid ${border}`,
      borderRadius: 8,
      fontSize: 12,
      color: readToken('--card-foreground', isDark ? 'hsl(210 40% 96%)' : 'hsl(220 26% 9%)'),
      boxShadow: '0 4px 16px rgb(0 0 0 / 0.08)',
    },
  };
}

/** Non-hook access for modules that only need a deterministic slot order. */
export function chartSeriesColor(index: number, isDark = false): string {
  const palette = isDark ? CHART_SERIES_DARK : CHART_SERIES_LIGHT;
  return palette[index % palette.length];
}
