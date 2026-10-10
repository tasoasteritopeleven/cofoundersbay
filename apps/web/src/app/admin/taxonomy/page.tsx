'use client';

import { StatusText } from '@/components/common/StatusText';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tags,
  Search,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Folder,
  Hash,
  Loader2,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { qk } from '@/lib/query-keys';
import { CANCELLED, choiceControl, ROW_GONE, rowOptions, settle, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  adminListSkills,
  adminCreateSkill,
  adminUpdateSkill,
  adminDeleteSkill,
  type AdminSkillItem,
} from '@/lib/api';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';

const SKILL_CATEGORIES = ['Technical', 'Business', 'Design', 'Marketing', 'Sales', 'Finance', 'Operations', 'Legal', 'Product', 'Data', 'Other'];

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function SkillRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-6 py-2 border-b last:border-b-0">
      <Skeleton className="icon-sm rounded" />
      <Skeleton className="h-4 flex-1 max-w-[160px]" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-5 w-10 rounded-full" />
      <Skeleton className="h-8 w-8 rounded-md" />
    </div>
  );
}

function SkillRow({
  skill,
  onEdit,
  onDelete,
}: {
  skill: AdminSkillItem;
  onEdit: (skill: AdminSkillItem) => void;
  onDelete: (skill: AdminSkillItem) => void;
}) {
  return (
    // The name starts on the card's axis: an empty spacer and a decorative
    // hash used to push every row 36px in.
    <div className="flex items-center gap-3 px-4 sm:px-6 py-2 hover:bg-muted/50 transition-colors border-b last:border-b-0">
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{skill.name}</span>
      <div className="ml-auto flex items-center gap-3">
      <span className="text-sm text-muted-foreground hidden sm:block">{skill.slug}</span>
      {skill.category && (
        <Badge variant="outline" className="text-xs hidden md:flex"><StatusText value={skill.category} /></Badge>
      )}
      <Badge variant="secondary" className="text-xs">{skill.count}</Badge>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label="More options" variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreVertical className="icon-sm" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(skill)}>
            <Edit className="mr-2 icon-sm" aria-hidden="true" />
            <BilingualText en="Edit" el="Επεξεργασία" compact />
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive-accessible" onClick={() => onDelete(skill)}>
            <Trash2 className="mr-2 icon-sm" />
            <BilingualText en="Delete" el="Διαγραφή" compact />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </div>
  );
}

function SkillDialog({
  open,
  skill,
  onClose,
  onSave,
  isSaving,
}: {
  open: boolean;
  skill: AdminSkillItem | null;
  onClose: () => void;
  onSave: (data: { name: string; slug: string; category: string }) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(skill?.name ?? '');
  const [slug, setSlug] = useState(skill?.slug ?? '');
  const [category, setCategory] = useState(skill?.category ?? '');
  const [autoSlug, setAutoSlug] = useState(!skill);

  // Reset when dialog opens
  useState(() => {
    setName(skill?.name ?? '');
    setSlug(skill?.slug ?? '');
    setCategory(skill?.category ?? '');
    setAutoSlug(!skill);
  });

  const handleNameChange = (val: string) => {
    setName(val);
    if (autoSlug) setSlug(slugify(val));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{skill ? <BilingualText en="Edit skill" el="Επεξεργασία δεξιότητας" compact /> : <BilingualText en="Add a skill" el="Προσθήκη δεξιότητας" compact />}</DialogTitle>
          <DialogDescription className="sr-only"><BilingualText en="Add or rename a taxonomy skill and choose its category." el="Προσθήκη ή μετονομασία δεξιότητας ταξινόμησης και επιλογή κατηγορίας." /></DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label htmlFor="tax-f1" className="block text-sm font-medium mb-1">Name *</label>
            <Input id="tax-f1" value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Machine Learning" />
          </div>
          <div>
            <label htmlFor="tax-f2" className="block text-sm font-medium mb-1">Slug *</label>
            <Input id="tax-f2"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setAutoSlug(false); }}
              placeholder="e.g. machine-learning"
            />
            <p className="text-xs text-muted-foreground mt-1"><BilingualText en="URL-friendly identifier, must be unique" el="Αναγνωριστικό για URL, μοναδικό" wrap /></p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="tax-category"><BilingualText en="Category" el="Κατηγορία" compact /></label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="tax-category">
                <SelectValue placeholder={bilingualInline("Select category", "Επιλογή κατηγορίας")} />
              </SelectTrigger>
              <SelectContent>
                {SKILL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
          <Button
            onClick={() => onSave({ name: name.trim(), slug: slug.trim(), category })}
            disabled={isSaving || !name.trim() || !slug.trim()}
          >
            {isSaving && <Loader2 className="mr-2 icon-sm animate-spin" aria-hidden="true" />}
            {skill ? 'Save Changes' : 'Add Skill'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminTaxonomyPage() {
  const qc = useQueryClient();
  const { success, error: showError } = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editTarget, setEditTarget] = useState<AdminSkillItem | null | 'new'>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qk('admin', 'skills', search, categoryFilter),
    queryFn: () => adminListSkills({ q: search || undefined, category: categoryFilter || undefined, limit: 200 }),
    staleTime: 30_000,
  });

  const skills = data?.items ?? [];
  const total = data?.total ?? 0;

  const categories = Array.from(new Set(skills.map((s) => s.category).filter(Boolean))) as string[];

  const groupedByCategory = SKILL_CATEGORIES.reduce<Record<string, AdminSkillItem[]>>((acc, cat) => {
    const items = skills.filter((s) => s.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});
  const uncategorized = skills.filter((s) => !s.category);

  const createMutation = useMutation({
    mutationFn: adminCreateSkill,
    onSuccess: () => {
      success('Skill created');
      qc.invalidateQueries({ queryKey: qk('admin', 'skills') });
      setEditTarget(null);
    },
    onError: (e: Error) => showError('Failed to create skill', e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof adminUpdateSkill>[1] }) =>
      adminUpdateSkill(id, body),
    onSuccess: () => {
      success('Skill updated');
      qc.invalidateQueries({ queryKey: qk('admin', 'skills') });
      setEditTarget(null);
    },
    onError: (e: Error) => showError('Failed to update skill', e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: adminDeleteSkill,
    onSuccess: () => {
      success('Skill deleted');
      qc.invalidateQueries({ queryKey: qk('admin', 'skills') });
    },
    onError: (e: Error) => showError('Failed to delete skill', e.message),
  });

  // The row's delete button and the assistant ask the same question in the
  // app's one confirm dialog. The command used to open a page-local dialog
  // and report done while it was still waiting for an answer.
  const deleteSkill = async (skill: AdminSkillItem): Promise<PageControlRunResult> => {
    const ok = await confirm({
      title: <BilingualText en={`Delete “${skill.name}”?`} el={`Διαγραφή «${skill.name}»;`} />,
      description: <BilingualText en="It is removed from every profile that lists it." el="Αφαιρείται από κάθε προφίλ που την αναφέρει." />,
      confirmLabel: <BilingualText en="Delete" el="Διαγραφή" compact secondaryClassName="text-destructive-foreground" />,
      variant: 'destructive',
    });
    if (!ok) return CANCELLED;
    return settle(() => deleteMutation.mutateAsync(skill.id));
  };

  const handleSave = (formData: { name: string; slug: string; category: string }) => {
    if (editTarget === 'new') {
      createMutation.mutate(formData);
    } else if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, body: formData });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Offered to the assistant: the category filter, New Skill, and the row
  // menu's Edit and Delete (which opens the same confirmation).
  usePageList([
    {
      id: 'skills',
      labelEn: 'Skills',
      labelEl: 'Δεξιότητες',
      rows: isLoading ? undefined : skills.map((sk) => `${sk.name} (${sk.slug}) · ${sk.category ?? 'uncategorised'} · used by ${sk.count}`),
      total,
    },
  ]);
  usePageControls([
    choiceControl('category_filter', 'Category filter', 'Φίλτρο κατηγορίας', [
      { value: 'all', en: 'All categories', el: 'Όλες οι κατηγορίες' },
      ...SKILL_CATEGORIES.map((c) => ({ value: c, en: c, el: c })),
    ], categoryFilter || 'all', (v) => setCategoryFilter(v === 'all' ? '' : v)),
    { id: 'new_skill', labelEn: 'Open the new skill form', labelEl: 'Άνοιγμα φόρμας νέας δεξιότητας', writes: false, run: () => setEditTarget('new') },
    { id: 'edit_skill', labelEn: 'Edit skill', labelEl: 'Επεξεργασία δεξιότητας', writes: false, options: rowOptions(skills, (sk) => sk.id, (sk) => sk.name), run: (v) => { const sk = skills.find((x) => x.id === v); if (sk) setEditTarget(sk); } },
    { id: 'delete_skill', labelEn: 'Delete skill', labelEl: 'Διαγραφή δεξιότητας', writes: true, options: rowOptions(skills, (sk) => sk.id, (sk) => sk.name), run: (v) => { const sk = skills.find((x) => x.id === v); return sk ? deleteSkill(sk) : ROW_GONE; } },
  ]);

  return (
    <AppShell
      actions={
        <>
          <div className="flex items-center gap-2">
            <Button aria-label="Refresh" variant="outline" size="icon" onClick={() => refetch()} title="Refresh" className="gap-1.5 sm:w-auto sm:px-3">
              <RefreshCw className="icon-sm" aria-hidden="true" />
              <span className="hidden sm:inline"><BilingualText en="Refresh" el="Ανανέωση" compact /></span>
            </Button>
            <Button onClick={() => setEditTarget('new')}>
              <Plus className="mr-2 icon-sm" aria-hidden="true" />
              <BilingualText en="Add Skill" el="Προσθήκη δεξιότητας" compact />
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 kpi-odd-span-md gap-4 md:grid-cols-4">
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground"><BilingualText en="Total Skills" el="Σύνολο δεξιοτήτων" compact /></p>
              {isLoading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="page-stat text-xl font-bold">{total}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground"><BilingualText en="Categories" el="Κατηγορίες" compact /></p>
              {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : <p className="page-stat text-xl font-bold">{categories.length}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground"><BilingualText en="Technical Skills" el="Τεχνικές δεξιότητες" compact /></p>
              {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : (
                <p className="page-stat text-xl font-bold">{skills.filter((s) => s.category === 'Technical').length}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground"><BilingualText en="Business Skills" el="Επιχειρηματικές δεξιότητες" compact /></p>
              {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : (
                <p className="page-stat text-xl font-bold">{skills.filter((s) => s.category === 'Business').length}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Skills Management */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Folder className="icon-md text-muted-foreground" />
                <CardTitle className="text-lg"><BilingualText en="Skills" el="Δεξιότητες" compact /></CardTitle>
                {!isLoading && <Badge variant="secondary">{total}</Badge>}
              </div>
              <Button size="sm" onClick={() => setEditTarget('new')}>
                <Plus className="mr-2 icon-sm" aria-hidden="true" />
                <BilingualText en="Add Skill" el="Προσθήκη δεξιότητας" compact />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground"><BilingualText en="Skills and expertise tags used across profiles" el="Ετικέτες δεξιοτήτων και εξειδίκευσης σε όλα τα προφίλ" wrap /></p>
          </CardHeader>
          <CardContent className="p-0">
            {/* Filters */}
            <div className="px-4 sm:px-6 pb-3 flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" aria-hidden="true" />
                <Input
                  aria-label={bilingualAria("Search skills", "Αναζήτηση δεξιοτήτων")}
                  placeholder={bilingualInline("Search skills…", "Αναζήτηση δεξιοτήτων…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
                {search && (
                  <button aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="icon-sm text-muted-foreground" aria-hidden="true" />
                  </button>
                )}
              </div>
              <select
                aria-label={bilingualAria("Filter skills by category", "Φιλτράρισμα δεξιοτήτων ανά κατηγορία")}
                className="ml-auto h-9 rounded-xl border border-input bg-background px-4 sm:px-6 text-sm"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">{bilingualInline("All categories", "Όλες οι κατηγορίες")}</option>
                {SKILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="border-t">
              {isError && (
                <div className="flex items-center gap-2 p-6 text-destructive-accessible justify-center">
                  <AlertCircle className="icon-md" />
                  <span className="text-sm"><BilingualText en="Failed to load skills." el="Δεν ήταν δυνατή η φόρτωση των δεξιοτήτων." compact wrap /></span>
                  <Button variant="outline" size="sm" onClick={() => refetch()}><BilingualText en="Retry" el="Δοκιμάστε ξανά" compact /></Button>
                </div>
              )}

              {isLoading && (
                <div className="max-h-[480px] overflow-y-auto">
                  {Array.from({ length: 8 }).map((_, i) => <SkillRowSkeleton key={i} />)}
                </div>
              )}

              {!isLoading && !isError && (
                <div className="max-h-[480px] overflow-y-auto">
                  {skills.length === 0 && (
                    <div className="py-12 text-center">
                      <Tags className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" aria-hidden="true" />
                      <p className="text-muted-foreground text-sm">
                        {search || categoryFilter ? 'No skills match your filter' : 'No skills yet — add your first skill'}
                      </p>
                    </div>
                  )}
                  {/* Grouped by category */}
                  {!categoryFilter && !search && Object.entries(groupedByCategory).map(([cat, items]) => (
                    <div key={cat}>
                      <div className="px-4 sm:px-6 py-1.5 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        <span>{cat} ({items.length})</span>
                      </div>
                      {items.map((skill) => (
                        <SkillRow key={skill.id} skill={skill} onEdit={setEditTarget} onDelete={(sk) => void deleteSkill(sk)} />
                      ))}
                    </div>
                  ))}
                  {/* Filtered flat list */}
                  {(categoryFilter || search) && skills.map((skill) => (
                    <SkillRow key={skill.id} skill={skill} onEdit={setEditTarget} onDelete={(sk) => void deleteSkill(sk)} />
                  ))}
                  {/* Uncategorized */}
                  {!categoryFilter && !search && uncategorized.length > 0 && (
                    <div>
                      <div className="px-4 sm:px-6 py-1.5 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        <span>Uncategorized ({uncategorized.length})</span>
                      </div>
                      {uncategorized.map((skill) => (
                        <SkillRow key={skill.id} skill={skill} onEdit={setEditTarget} onDelete={(sk) => void deleteSkill(sk)} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <SkillDialog
        open={editTarget !== null}
        skill={editTarget === 'new' ? null : editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleSave}
        isSaving={isSaving}
      />

    </AppShell>
  );
}
