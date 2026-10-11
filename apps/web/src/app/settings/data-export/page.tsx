'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Download, Shield, Check, AlertTriangle, Loader2, ArrowLeft, Archive, Trash2,
  User, Users, MessageCircle, Calendar, Briefcase, Settings,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { getAccountExport, type AccountExport, type AccountExportSection } from '@/lib/api';
import { bilingualInline, formatDate } from '@/lib/i18n/format';
import { usePageControls, usePageList } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';

type DataCategory = {
  id: AccountExportSection;
  label: string;
  labelEl: string;
  description: string;
  descriptionEl: string;
  icon: React.ElementType;
  included: boolean;
};

/** One download made on this visit: exports are built on request, not stored. */
type SessionExport = {
  at: string;
  sections: AccountExportSection[];
  bytes: number;
  unavailable: AccountExport['unavailable'];
};

const DATA_CATEGORIES: DataCategory[] = [
  { id: 'profile', label: 'Profile information', labelEl: 'Στοιχεία προφίλ', description: 'Your account, name, bio and skills', descriptionEl: 'Ο λογαριασμός, το όνομα, το βιογραφικό και οι δεξιότητές σας', icon: User, included: true },
  { id: 'messages', label: 'Messages', labelEl: 'Μηνύματα', description: 'The messages you sent', descriptionEl: 'Τα μηνύματα που στείλατε', icon: MessageCircle, included: true },
  { id: 'connections', label: 'Connections', labelEl: 'Συνδέσεις', description: 'Requests you sent and received, and their outcome', descriptionEl: 'Αιτήματα που στείλατε και λάβατε, και η έκβασή τους', icon: Users, included: true },
  { id: 'activity', label: 'Activity history', labelEl: 'Ιστορικό δραστηριότητας', description: 'Event RSVPs, groups, mentor bookings, endorsements, saved profiles, notifications', descriptionEl: 'Δηλώσεις σε εκδηλώσεις, ομάδες, κρατήσεις μεντόρων, συστάσεις, αποθηκευμένα προφίλ, ειδοποιήσεις', icon: Calendar, included: true },
  { id: 'milestones', label: 'Milestones', labelEl: 'Ορόσημα', description: 'Goals you own or share', descriptionEl: 'Στόχοι που έχετε ή μοιράζεστε', icon: Briefcase, included: true },
  { id: 'settings', label: 'Account settings', labelEl: 'Ρυθμίσεις λογαριασμού', description: 'Visibility, two-factor and linked sign-in providers', descriptionEl: 'Ορατότητα, έλεγχος δύο παραγόντων και συνδεδεμένοι πάροχοι σύνδεσης', icon: Settings, included: true },
];

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Hand the browser a file, the way a download link would. */
function saveJson(doc: AccountExport): number {
  const text = JSON.stringify(doc, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cofounderbay-export-${doc.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return blob.size;
}

/*
 * The page used to "request" an export and poll for its status, but both
 * requests went to a route that did not exist - no export was ever produced,
 * and the polling never settled. The API now builds the reader's data when
 * asked (GET /api/account/export) and nothing is stored, so the button
 * downloads the file directly, and the list below is what this visit
 * downloaded rather than a server-side history that was never kept.
 */
export default function DataExportPage() {
  const { success, error: showError } = useToast();
  const [selectedCategories, setSelectedCategories] = useState<Set<AccountExportSection>>(
    new Set(DATA_CATEGORIES.map((c) => c.id)),
  );
  const [downloads, setDownloads] = useState<SessionExport[]>([]);

  const exportMutation = useMutation({
    mutationFn: () => getAccountExport(DATA_CATEGORIES.map((c) => c.id).filter((id) => selectedCategories.has(id))),
    onSuccess: (doc) => {
      const bytes = saveJson(doc);
      setDownloads((prev) => [{ at: doc.exportedAt, sections: doc.sections, bytes, unavailable: doc.unavailable }, ...prev]);
      success(
        bilingualInline('Your data is downloading', 'Τα δεδομένα σας κατεβαίνουν'),
        doc.unavailable.length
          ? bilingualInline(`${doc.unavailable.length} part(s) could not be read; the file lists them.`, `${doc.unavailable.length} τμήμα(τα) δεν διαβάστηκαν· το αρχείο τα αναφέρει.`)
          : bilingualInline('One JSON file with everything you selected.', 'Ένα αρχείο JSON με όσα επιλέξατε.'),
      );
    },
    onError: (e) => {
      showError(bilingualInline('Export failed', 'Η εξαγωγή απέτυχε'), e instanceof Error ? e.message : bilingualInline('Please try again.', 'Δοκιμάστε ξανά.'));
    },
  });

  const toggleCategory = (id: AccountExportSection) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Offered to the assistant: which categories go in, and the download - the
  // same toggle and request. Reading your own data writes nothing.
  const categoryOption = (c: DataCategory) => ({ value: c.id, labelEn: c.label, labelEl: c.labelEl });
  usePageList([
    {
      id: 'exports',
      labelEn: 'Exports downloaded on this visit',
      labelEl: 'Εξαγωγές που κατέβηκαν σε αυτή την επίσκεψη',
      rows: downloads.map((d) => `${d.at.slice(0, 16).replace('T', ' ')} UTC · ${d.sections.join(', ')} · ${sizeLabel(d.bytes)}${d.unavailable.length ? ` · ${d.unavailable.length} part(s) unreadable` : ''}`),
    },
  ]);
  usePageControls([
    { id: 'include_category', labelEn: 'Include in the export', labelEl: 'Συμπερίληψη στην εξαγωγή', writes: false, options: DATA_CATEGORIES.filter((c) => !selectedCategories.has(c.id)).map(categoryOption), run: (v) => { if (v) toggleCategory(v as AccountExportSection); } },
    { id: 'exclude_category', labelEn: 'Leave out of the export', labelEl: 'Εξαίρεση από την εξαγωγή', writes: false, options: DATA_CATEGORIES.filter((c) => selectedCategories.has(c.id)).map(categoryOption), run: (v) => { if (v) toggleCategory(v as AccountExportSection); } },
    {
      id: 'download_export',
      labelEn: 'Download my data',
      labelEl: 'Λήψη των δεδομένων μου',
      writes: false,
      unavailableEn: selectedCategories.size === 0 ? 'Choose at least one category.' : undefined,
      unavailableEl: selectedCategories.size === 0 ? 'Επιλέξτε τουλάχιστον μία κατηγορία.' : undefined,
      run: () => exportMutation.mutate(),
    },
  ]);

  return (
    <AppShell title="Data export" titleEl="Εξαγωγή δεδομένων" description="Download a copy of your data" descriptionEl="Κατεβάστε ένα αντίγραφο των δεδομένων σας">
      <div className="w-full space-y-6">
        <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="icon-sm" aria-hidden="true" />
          <BilingualText en="Back to Settings" el="Επιστροφή στις ρυθμίσεις" compact />
        </Link>

        <Card className="border-primary/15 bg-primary/5">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <Shield className="icon-md mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="mb-1 text-sm font-medium text-foreground"><BilingualText en="Your Data Rights" el="Τα δικαιώματά σας στα δεδομένα" compact /></p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <BilingualText
                    en="Under GDPR you can receive a copy of your personal data in a portable format. The file is built when you ask for it and is not kept on our servers. Passwords, sign-in tokens and two-factor secrets are never included."
                    el="Βάσει GDPR μπορείτε να λάβετε αντίγραφο των προσωπικών σας δεδομένων σε φορητή μορφή. Το αρχείο δημιουργείται όταν το ζητάτε και δεν φυλάσσεται στους διακομιστές μας. Κωδικοί, διακριτικά σύνδεσης και μυστικά δύο παραγόντων δεν περιλαμβάνονται ποτέ."
                    wrap
                  />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base"><BilingualText en="Choose what to include" el="Επιλέξτε τι θα περιλαμβάνει" compact /></CardTitle>
            <CardDescription>
              <BilingualText en="Select the data you want to include in your export" el="Επιλέξτε τα δεδομένα που θα περιλαμβάνει η εξαγωγή" wrap />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 space-y-3">
              {DATA_CATEGORIES.map((category) => {
                const Icon = category.icon;
                const isSelected = selectedCategories.has(category.id);
                return (
                  <label
                    key={category.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-ring',
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30',
                    )}
                  >
                    <input type="checkbox" checked={isSelected} onChange={() => toggleCategory(category.id)} className="sr-only" />
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', isSelected ? 'bg-primary/10' : 'bg-muted')}>
                      <Icon className={cn('icon-sm', isSelected ? 'text-primary-accessible' : 'text-muted-foreground')} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground"><BilingualText en={category.label} el={category.labelEl} compact /></p>
                      <p className="text-xs text-muted-foreground"><BilingualText en={category.description} el={category.descriptionEl} wrap /></p>
                    </div>
                    <div className={cn('flex h-5 w-5 items-center justify-center rounded-sm border-2 transition-colors', isSelected ? 'border-primary bg-primary' : 'border-border')} aria-hidden="true">
                      {isSelected && <Check className="icon-sm text-primary-foreground" />}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                <BilingualText
                  en={`${selectedCategories.size} of ${DATA_CATEGORIES.length} categories selected`}
                  el={`${selectedCategories.size} από ${DATA_CATEGORIES.length} κατηγορίες`}
                  compact
                />
              </p>
              <Button onClick={() => exportMutation.mutate()} disabled={selectedCategories.size === 0 || exportMutation.isPending} className="gap-2">
                {exportMutation.isPending ? <Loader2 className="icon-sm animate-spin" aria-hidden="true" /> : <Download className="icon-sm" aria-hidden="true" />}
                {exportMutation.isPending
                  ? <BilingualText en="Preparing…" el="Προετοιμασία…" compact />
                  : <BilingualText en="Download my data" el="Λήψη των δεδομένων μου" compact />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {downloads.length > 0 && (
          <section aria-labelledby="export-history">
            <h2 id="export-history" className="mb-3 text-sm font-semibold text-foreground">
              <BilingualText en="Downloaded on this visit" el="Λήψεις σε αυτή την επίσκεψη" compact />
            </h2>
            <ul className="space-y-3">
              {downloads.map((d) => (
                <li key={d.at}>
                  <Card className="border-border">
                    <CardContent className="flex items-start gap-3 pt-5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-status-success-bg">
                        <Archive className="icon-md text-status-success" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          <BilingualText en={formatDate(d.at, 'en', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} el={formatDate(d.at, 'el', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} compact />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {d.sections.map((id) => {
                            const c = DATA_CATEGORIES.find((x) => x.id === id);
                            return c ? bilingualInline(c.label, c.labelEl) : id;
                          }).join(' · ')} · {sizeLabel(d.bytes)}
                        </p>
                        {d.unavailable.length > 0 && (
                          <p className="mt-1 flex items-start gap-1 text-xs text-status-warning">
                            <AlertTriangle className="icon-sm mt-0.5 shrink-0" aria-hidden="true" />
                            <BilingualText
                              en={`Not readable: ${d.unavailable.map((u) => u.part).join(', ')}. The file names them too.`}
                              el={`Δεν διαβάστηκαν: ${d.unavailable.map((u) => u.part).join(', ')}. Το αρχείο τα αναφέρει επίσης.`}
                              wrap
                            />
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <Trash2 className="icon-md mt-0.5 shrink-0 text-destructive-accessible" aria-hidden="true" />
            <div>
              <p className="mb-1 text-sm font-medium text-foreground"><BilingualText en="Delete Your Account" el="Διαγραφή του λογαριασμού σας" compact /></p>
              <p className="mb-3 text-xs text-muted-foreground">
                <BilingualText
                  en="Account deletion is handled by support: start from account settings."
                  el="Τη διαγραφή λογαριασμού τη χειρίζεται η υποστήριξη: ξεκινήστε από τις ρυθμίσεις λογαριασμού."
                  wrap
                />
              </p>
              <Button variant="outline" size="sm" className="border-destructive/30 text-destructive-accessible hover:bg-destructive/10" asChild>
                <Link href="/settings">
                  <BilingualText en="Go to Account Settings" el="Μετάβαση στις ρυθμίσεις λογαριασμού" compact />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
