'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Lazy-loaded components with loading fallbacks for better performance.
 * Heavy components are code-split and loaded on demand.
 */

// Chart components (recharts is heavy ~100kb)
export const LazyLineChart = dynamic(
  () => import('recharts').then((mod) => ({ default: mod.LineChart })),
  {
    loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
    ssr: false,
  }
);

export const LazyBarChart = dynamic(
  () => import('recharts').then((mod) => ({ default: mod.BarChart })),
  {
    loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
    ssr: false,
  }
);

export const LazyAreaChart = dynamic(
  () => import('recharts').then((mod) => ({ default: mod.AreaChart })),
  {
    loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
    ssr: false,
  }
);

export const LazyPieChart = dynamic(
  () => import('recharts').then((mod) => ({ default: mod.PieChart })),
  {
    loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
    ssr: false,
  }
);

export const LazyRadarChart = dynamic(
  () => import('recharts').then((mod) => ({ default: mod.RadarChart })),
  {
    loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
    ssr: false,
  }
);

export const LazyResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => ({ default: mod.ResponsiveContainer })),
  {
    loading: () => <Skeleton className="h-full w-full rounded-xl" />,
    ssr: false,
  }
);

// Command palette (heavy with fuzzy search)
export const LazyCommandPalette = dynamic(
  () => import('@/components/common/CommandPalette').then((mod) => ({ default: mod.CommandPalette })),
  {
    loading: () => null,
    ssr: false,
  }
);
