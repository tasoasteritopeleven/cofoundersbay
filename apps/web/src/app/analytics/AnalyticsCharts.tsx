'use client';

import { useId } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BilingualText } from '@/components/common/BilingualText';
import { useDemoData } from '@/contexts/DemoDataContext';
import { Download } from 'lucide-react';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { analyticsEn, analyticsEl } from '@/lib/i18n/strings-analytics';
import type { AnalyticsEngagement, AnalyticsProfileView } from '@/lib/api';

const DEMO_AREA_DATA = [
  { date: 'Mon', views: 12, unique: 8 },
  { date: 'Tue', views: 19, unique: 14 },
  { date: 'Wed', views: 8, unique: 6 },
  { date: 'Thu', views: 24, unique: 18 },
  { date: 'Fri', views: 18, unique: 13 },
  { date: 'Sat', views: 31, unique: 22 },
  { date: 'Sun', views: 27, unique: 20 },
];

const DEMO_BAR_DATA = [
  { name: 'Connections', value: 18 },
  { name: 'Messages', value: 34 },
  { name: 'Likes', value: 12 },
  { name: 'Comments', value: 8 },
  { name: 'Shares', value: 5 },
];

const CHART_SERIES_COLORS = [
  'hsl(var(--primary))', 'hsl(var(--status-info-mark))', 'hsl(var(--status-success-mark))',
  'hsl(var(--status-warning-mark))', 'hsl(var(--status-danger-mark))',
] as const;
const PIE_COLORS = [...CHART_SERIES_COLORS];
const TOOLTIP_STYLE = {
  background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
  borderRadius: 'var(--radius)', fontSize: 12.2412,
};

function Unavailable() {
  return <p className="py-8 text-sm text-muted-foreground"><BilingualText en="Data unavailable. No sample values have been substituted." el="Τα δεδομένα δεν είναι διαθέσιμα. Δεν έχουν αντικατασταθεί με ενδεικτικές τιμές." /></p>;
}

function SampleNotice() {
  return <p className="mb-3 text-xs text-muted-foreground"><BilingualText en="Sample data — demonstration only." el="Ενδεικτικά δεδομένα — μόνο για επίδειξη." /></p>;
}

export function ProfileViewsChart({ data }: { data: AnalyticsProfileView[] }) {
  const { showDemoData } = useDemoData();
  const id = useId().replace(/:/g, '');
  const isSample = data.length === 0 && showDemoData;
  const chartData = data.length ? data.map((d) => ({ date: d.date, views: d.views, unique: d.uniqueVisitors }))
    : isSample ? DEMO_AREA_DATA : [];
  const exportData = (format: 'json' | 'csv') => {
    if (format === 'csv') {
      const csv = ['date,views,unique', ...chartData.map((point) => `${point.date},${point.views},${point.unique ?? ''}`)].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = isSample ? 'profile-views-sample.csv' : 'profile-views.csv';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    const blob = new Blob([JSON.stringify({ sample: isSample, data: chartData }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = isSample ? 'profile-views-sample.json' : 'profile-views.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex min-w-0 items-center gap-2 font-semibold">
            <CfbGlyph name="chart" className="icon-sm shrink-0 text-muted-foreground" /><BilingualText en="Profile Views Trend" el="Τάση προβολών προφίλ" compact />
          </CardTitle>
          <div className="flex shrink-0 flex-wrap gap-1">
            <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={() => exportData('json')} disabled={!chartData.length}>
              <Download className="icon-sm" aria-hidden="true" /><BilingualText en="Export" el="Εξαγωγή" compact />
            </Button>
            <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={() => exportData('csv')} disabled={!chartData.length}>
              <Download className="icon-sm" aria-hidden="true" /><BilingualText en={analyticsEn('export_csv')} el={analyticsEl('export_csv')} compact />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isSample && <SampleNotice />}
        {chartData.length ? <>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id={`${id}-views`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`${id}-unique`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--status-info-mark))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--status-info-mark))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis dataKey="date" tick={{ fontSize: 12.2412 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 12.2412 }} className="text-muted-foreground" />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} fill={`url(#${id}-views)`} name={analyticsEn('series_views')} />
              <Area type="monotone" dataKey="unique" stroke="hsl(var(--status-info-mark))" strokeWidth={2} fill={`url(#${id}-unique)`} name={analyticsEn('series_unique')} connectNulls={false} />
            </AreaChart>
          </ResponsiveContainer>
          <details className="mt-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer rounded-xl focus-visible:outline-none"><BilingualText en="View recorded values" el="Προβολή καταγεγραμμένων τιμών" compact /></summary>
            <ul className="mt-3 space-y-1.5">{chartData.map((point) => <li key={point.date}>{point.date}: {point.views} / {point.unique ?? '—'}</li>)}</ul>
          </details>
        </> : <Unavailable />}
      </CardContent>
    </Card>
  );
}

export function EngagementBreakdown({ engagement }: { engagement?: AnalyticsEngagement }) {
  const { showDemoData } = useDemoData();
  const isSample = engagement === undefined && showDemoData;
  const labels = [
    ['Connections', 'Συνδέσεις', 'connections'], ['Messages', 'Μηνύματα', 'messages'],
    ['Likes', 'Μου αρέσει', 'likes'], ['Comments', 'Σχόλια', 'comments'], ['Shares', 'Κοινοποιήσεις', 'shares'],
  ] as const;
  const values = labels.map(([name, el, key], index) => ({ name, el, value: isSample ? DEMO_BAR_DATA[index].value : engagement?.[key] }));
  const barData = values.filter((item) => typeof item.value === 'number' && Number.isFinite(item.value))
    .map((item) => ({ name: item.name, value: item.value as number }));
  const pieData = barData.filter((item) => item.value > 0);

  return (
    <div className="space-y-5">
      {isSample && <SampleNotice />}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 font-semibold">
          <CfbGlyph name="chart" className="icon-sm text-muted-foreground" /><BilingualText en="Engagement by Type" el="Αλληλεπίδραση ανά τύπο" compact />
        </CardTitle></CardHeader>
        <CardContent>
          {barData.length ? <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis dataKey="name" tick={{ fontSize: 12.2412 }} interval={0} className="text-muted-foreground" />
              <YAxis width={36} tick={{ fontSize: 12.2412 }} className="text-muted-foreground" />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>{barData.map((item, index) => <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer> : <Unavailable />}
          <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">{values.map((item) => <li key={item.name}>
            <BilingualText en={`${item.name}: ${typeof item.value === 'number' && Number.isFinite(item.value) ? item.value : 'Unavailable'}`} el={`${item.el}: ${typeof item.value === 'number' && Number.isFinite(item.value) ? item.value : 'Μη διαθέσιμο'}`} compact />
          </li>)}</ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 font-semibold">
          <CfbGlyph name="compare" className="icon-sm text-muted-foreground" /><BilingualText en="Engagement Distribution" el="Κατανομή αλληλεπίδρασης" compact />
        </CardTitle></CardHeader>
        <CardContent>
          {pieData.length ? <ResponsiveContainer width="100%" height={180}>
            <RechartsPie><Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
              {pieData.map((item, index) => <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
            </Pie><Tooltip contentStyle={TOOLTIP_STYLE} /><Legend iconSize={8} wrapperStyle={{ fontSize: 12.2412 }} /></RechartsPie>
          </ResponsiveContainer> : <p className="py-8 text-sm text-muted-foreground"><BilingualText en={barData.length ? 'No recorded engagement to distribute in this period.' : 'Engagement distribution unavailable.'} el={barData.length ? 'Δεν υπάρχει καταγεγραμμένη αλληλεπίδραση για κατανομή σε αυτή την περίοδο.' : 'Η κατανομή αλληλεπίδρασης δεν είναι διαθέσιμη.'} /></p>}
        </CardContent>
      </Card>
    </div>
  );
}
