'use client';

import { useState } from 'react';
import {
  KeyRound,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  MoreVertical,
  Clock,
  Shield,
  CheckCircle,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDemoData } from '@/contexts/DemoDataContext';
import { EmptyTenantApiKeys } from '@/components/common/EmptyStates';
import { cn } from '@/lib/utils';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { UnavailableMenuItem } from '@/components/common/UnavailableMenuItem';
import { UnavailableButton } from '@/components/common/UnavailableButton';
import { BilingualText } from '@/components/common/BilingualText';
import { usePageList } from '@/lib/page-controls';

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsed?: string;
  expiresAt?: string;
  isActive: boolean;
};

const MOCK_KEYS: ApiKey[] = [
  { id: '1', name: 'Production Integration', prefix: 'cfb_prod_', scopes: ['read:users', 'write:programs', 'read:analytics'], createdAt: 'Jan 12, 2025', lastUsed: '1 hour ago', isActive: true },
  { id: '2', name: 'Zapier Automation', prefix: 'cfb_zap_', scopes: ['read:users', 'write:webhooks'], createdAt: 'Feb 3, 2025', lastUsed: 'Yesterday', isActive: true },
  { id: '3', name: 'Dev Testing', prefix: 'cfb_dev_', scopes: ['read:all'], createdAt: 'Mar 1, 2025', expiresAt: 'Apr 1, 2025', isActive: false },
];

function KeyRow({ apiKey }: { apiKey: ApiKey }) {
  const [revealed, setRevealed] = useState(false);
  const maskedKey = `${apiKey.prefix}${'•'.repeat(24)}`;
  const revealedKey = `${apiKey.prefix}abc123xyz789defghijklmnopqr`;

  return (
    <div className={cn('p-4 rounded-lg border transition-all hover:border-primary/20', !apiKey.isActive && 'surface-inactive')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium">{apiKey.name}</p>
            {apiKey.isActive ? (
              <Badge variant="outline" size="sm" className="bg-status-success-bg text-status-success border-status-success-border"><CheckCircle className="mr-1 icon-sm" aria-hidden="true" /><BilingualText en="Active" el="Ενεργό" compact /></Badge>
            ) : (
              <Badge variant="outline" size="sm" className="bg-muted text-foreground"><BilingualText en="Inactive" el="Ανενεργό" compact /></Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <code tabIndex={0} className="min-w-0 flex-1 overflow-x-auto text-xs font-mono bg-muted px-2 py-1 rounded">{revealed ? revealedKey : maskedKey}</code>
            <Button className="shrink-0" aria-label={revealed ? 'Hide key. Απόκρυψη κλειδιού' : 'Show key. Εμφάνιση κλειδιού'} aria-pressed={revealed} variant="ghost" size="icon" onClick={() => setRevealed(!revealed)}>
              {revealed ? <EyeOff className="icon-sm" aria-hidden="true" /> : <Eye className="icon-sm" aria-hidden="true" />}
            </Button>
            <Button className="shrink-0" aria-label="Copy key. Αντιγραφή κλειδιού" variant="ghost" size="icon" onClick={() => void navigator.clipboard?.writeText(revealedKey)}><Copy className="icon-sm" aria-hidden="true" /></Button>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {apiKey.scopes.map(s => (
              <Badge key={s} variant="secondary" size="sm" translate="no">{s}</Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="icon-sm" aria-hidden="true" /><BilingualText en={`Created ${apiKey.createdAt}`} el={`Δημιουργήθηκε ${apiKey.createdAt}`} compact /></span>
            {apiKey.lastUsed && <span><BilingualText en={`Last used ${apiKey.lastUsed}`} el={`Τελευταία χρήση ${apiKey.lastUsed}`} compact /></span>}
            {apiKey.expiresAt && <span className="text-status-warning"><BilingualText en={`Expires ${apiKey.expiresAt}`} el={`Λήγει ${apiKey.expiresAt}`} compact /></span>}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="More options. Περισσότερες επιλογές" variant="ghost" size="icon" className="shrink-0">
              <MoreVertical className="icon-sm" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* No key service exists; each item says so rather than closing silently. */}
            <UnavailableMenuItem en="Edit Scopes" el="Επεξεργασία δικαιωμάτων" reasonEn="No key service yet." reasonEl="Δεν υπάρχει ακόμη υπηρεσία κλειδιών." />
            <UnavailableMenuItem en="Regenerate" el="Αναδημιουργία" reasonEn="No key service yet." reasonEl="Δεν υπάρχει ακόμη υπηρεσία κλειδιών." />
            <UnavailableMenuItem className="text-destructive-accessible" icon={<Trash2 className="mr-2 mt-0.5 icon-sm" aria-hidden="true" />} en="Revoke" el="Ανάκληση" reasonEn="Sample key - nothing to revoke." reasonEl="Δείγμα - δεν υπάρχει κάτι να ανακληθεί." />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function TenantApiKeysPage() {
  const { showDemoData } = useDemoData();
  const keys = showDemoData ? MOCK_KEYS : [];

  // Names and scopes only - never a key, sample or not.
  usePageList([
    {
      id: 'api_keys',
      labelEn: 'API keys',
      labelEl: 'Κλειδιά API',
      rows: keys.map((k) => `${k.name} · ${k.isActive ? 'active' : 'inactive'} · ${k.scopes.join(', ')}`),
      total: keys.length,
      sample: keys.length > 0,
    },
  ]);

  return (
    <AppShell
      title="API Keys"
      description="Manage API keys for programmatic access to your tenant data"
      descriptionEl="Διαχειριστείτε κλειδιά API για προγραμματιστική πρόσβαση στα δεδομένα του οργανισμού σας"
      actions={
        // Had no handler; there is no key-issuing service behind this page.
        <UnavailableButton
          en="Create API key"
          el="Νέο κλειδί API"
          reasonEn="Issuing keys needs a key service the platform does not run yet."
          reasonEl="Η έκδοση κλειδιών χρειάζεται υπηρεσία που η πλατφόρμα δεν έχει ακόμη."
        />
      }
    >
      <div className="space-y-6">
        {showDemoData && (
          <SampleDataNotice
            surface="API keys"
            detail="These keys are illustrative - no key-issuing service exists yet, so none of them authenticate anything."
            askAiPrompt="Why does the API keys page show sample keys?"
          />
        )}
        <Card className="border-status-warning-border bg-status-warning-bg">
          <CardContent className="flex items-center gap-3">
            <Shield className="icon-md text-status-warning shrink-0" aria-hidden="true" />
            <p className="text-sm">
              <BilingualText
                en="API keys grant full access to your tenant's resources. Store them securely and never share them publicly."
                el="Τα κλειδιά API δίνουν πλήρη πρόσβαση στους πόρους του οργανισμού σας. Φυλάξτε τα με ασφάλεια και μην τα δημοσιεύετε ποτέ."
                wrap
              />
            </p>
          </CardContent>
        </Card>

        {keys.length === 0 ? (
          <EmptyTenantApiKeys />
        ) : (
          <div className="space-y-3">
            {keys.map(k => <KeyRow key={k.id} apiKey={k} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}
