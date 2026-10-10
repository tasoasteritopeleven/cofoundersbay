'use client';

import { useState, useId } from 'react';
import { Loader2, Globe, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { createGroup, type GroupPrivacy } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { bilingualInline } from '@/lib/i18n/format';
import { StatusText, statusEl } from '@/components/common/StatusText';
import { BilingualText } from '@/components/common/BilingualText';

const CATEGORIES = ['Founders', 'Tech', 'Marketing', 'Design', 'Finance', 'Product', 'Operations', 'Legal'];

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateGroupModal({ onClose, onCreated }: Props) {
  const { success, error: toastError } = useToast();
  const fieldId = useId();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    category: '',
    privacy: 'public' as GroupPrivacy,
    tags: '',
  });

  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleNameChange = (name: string) => {
    setForm((f) => ({ ...f, name, slug: slugify(name) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) return;
    setLoading(true);
    try {
      await createGroup({
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || undefined,
        category: form.category || undefined,
        privacy: form.privacy,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      });
      success('Group created!', `"${form.name}" is ready.`);
      onCreated();
    } catch (err: any) {
      toastError('Error', err?.message ?? 'Failed to create group.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle><BilingualText en="Create Community" el="Δημιουργία κοινότητας" compact /></DialogTitle>
          <DialogDescription className="sr-only"><BilingualText en="Name the community, choose its URL slug and set who can join." el="Ονομάστε την κοινότητα, επιλέξτε το slug της και ορίστε ποιοι μπορούν να συμμετάσχουν." /></DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-name`} className="text-sm font-medium text-muted-foreground">
              <BilingualText en="Community name" el="Όνομα κοινότητας" compact /> *
            </label>
            <Input
              id={`${fieldId}-name`}
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={bilingualInline('e.g. SaaS Founders Hub', 'π.χ. SaaS Founders Hub')}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-slug`} className="text-sm font-medium text-muted-foreground">
              <BilingualText en="Slug (URL)" el="Slug (URL)" compact /> *
            </label>
            <div className="flex items-center gap-0 rounded-lg border border-input overflow-hidden">
              <span className="bg-secondary/60 px-3 py-2 text-xs text-muted-foreground border-r border-input">/groups/</span>
              <input
                id={`${fieldId}-slug`}
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                placeholder="saas-founders-hub"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-desc`} className="text-sm font-medium text-muted-foreground">
              <BilingualText en="Description" el="Περιγραφή" compact />
            </label>
            <textarea
              id={`${fieldId}-desc`}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none resize-none"
              rows={3}
              placeholder={bilingualInline("What is this group about?", "Ποιο είναι το θέμα της κοινότητας;")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor={`${fieldId}-category`} className="text-sm font-medium text-muted-foreground">
                <BilingualText en="Category" el="Κατηγορία" compact />
              </label>
              <select
                id={`${fieldId}-category`}
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none"
              >
                <option value="">{bilingualInline('None', 'Καμία')}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{bilingualInline(c, statusEl(c))}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                <BilingualText en="Privacy" el="Απόρρητο" compact />
              </p>
              <div className="flex gap-2" role="group" aria-label={bilingualInline('Privacy', 'Απόρρητο')}>
                {(['public', 'private'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={form.privacy === p}
                    onClick={() => setForm((f) => ({ ...f, privacy: p }))}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-medium transition-colors',
                      form.privacy === p
                        ? 'border-primary bg-primary/15 text-primary-accessible'
                        : 'border-border text-muted-foreground hover:border-primary/40',
                    )}
                  >
                    {p === 'public' ? <Globe className="icon-sm" aria-hidden="true" /> : <Lock className="icon-sm" aria-hidden="true" />}
                    <StatusText value={p} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-tags`} className="text-sm font-medium text-muted-foreground">
              <BilingualText en="Tags (comma-separated)" el="Ετικέτες (με κόμμα)" compact />
            </label>
            <Input
              id={`${fieldId}-tags`}
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="SaaS, B2B, Growth"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              <BilingualText en="Cancel" el="Ακύρωση" compact />
            </Button>
            <Button type="submit" className="flex-1 gap-2" disabled={loading || !form.name.trim()}>
              {loading ? <Loader2 className="icon-sm animate-spin" /> : null}
              <BilingualText en="Create Community" el="Δημιουργία κοινότητας" compact />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
