import io

# ── /mentor/earnings ────────────────────────────────────────────────────────
p = 'src/app/mentor/earnings/page.tsx'
s = io.open(p, encoding='utf-8').read()

old = """import { AppShell } from '@/components/layout/AppShell';"""
new = """import { AppShell } from '@/components/layout/AppShell';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';"""
assert s.count(old) == 1; s = s.replace(old, new)

old = """  const transactions = showDemoData ? MOCK_TRANSACTIONS : [];
  const monthlyData = showDemoData ? MOCK_MONTHLY : [];
"""
new = """  const allTransactions = showDemoData ? MOCK_TRANSACTIONS : [];
  const monthlyData = showDemoData ? MOCK_MONTHLY : [];

  /* The period select used to be set dressing - it now bounds the session
     history it sits above. */
  const periodDays: Record<string, number> = {
    this_month: 31,
    last_month: 62,
    last_3: 92,
    last_6: 183,
    ytd: 366,
  };
  const cutoff = Date.now() - (periodDays[period] ?? 31) * 86_400_000;
  const transactions = allTransactions.filter((t) => new Date(t.date).getTime() >= cutoff);

  const exportCsv = () => {
    if (!transactions.length) return;
    const header = 'Date,Mentee,Topic,Duration (min),Amount,Currency,Status\\n';
    const body = transactions
      .map((t) => [t.date, t.mentee.name, `"${t.topic.replace(/"/g, '""')}"`, t.duration, t.amount, t.currency, t.status].join(','))
      .join('\\n');
    const url = URL.createObjectURL(new Blob([header + body], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `earnings-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
"""
assert s.count(old) == 1; s = s.replace(old, new)

old = """            <Button variant="outline" size="sm">
              <Download className="mr-2 icon-sm" />
              Export
            </Button>"""
new = """            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!transactions.length}>
              <Download className="mr-2 icon-sm" />
              Export
            </Button>"""
assert s.count(old) == 1; s = s.replace(old, new)

old = """      <div className="py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">"""
new = """      <div className="py-6 space-y-6">
        {showDemoData && (
          <SampleDataNotice
            surface="Earnings"
            detail="Transactions and monthly totals are illustrative - there is no mentor earnings ledger yet."
            askAiPrompt="Why does the earnings page show sample transactions?"
          />
        )}
        {/* Header */}
        <div className="flex items-center justify-between">"""
assert s.count(old) == 1; s = s.replace(old, new)

# the two fabricated trend badges
old = """            value={formatCurrency(totalEarned)}
            sub="from paid sessions"
            trend={{ value: 58, positive: true }}
          />"""
new = """            value={formatCurrency(totalEarned)}
            sub="from paid sessions"
          />"""
assert s.count(old) == 1; s = s.replace(old, new)

old = """            value={String(totalSessions)}
            sub="this period"
            trend={{ value: 20, positive: true }}
          />"""
new = """            value={String(totalSessions)}
            sub="this period"
          />"""
assert s.count(old) == 1; s = s.replace(old, new)

# payout connect buttons: no payout backend -> honest disabled state
old = """                  <Button size="sm">
                    <ArrowUpRight className="mr-2 icon-sm" />
                    Connect
                  </Button>"""
new = """                  <Button size="sm" disabled title="Payout providers are not connected yet">
                    <ArrowUpRight className="mr-2 icon-sm" />
                    Connect
                  </Button>"""
assert s.count(old) == 1; s = s.replace(old, new)

old = """                      <span className="text-sm font-medium">{method}</span>
                      <Button variant="outline" size="sm">Connect</Button>"""
new = """                      <span className="text-sm font-medium">{method}</span>
                      <Button variant="outline" size="sm" disabled title="Payout providers are not connected yet">Connect</Button>"""
assert s.count(old) == 1; s = s.replace(old, new)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('earnings ok')
