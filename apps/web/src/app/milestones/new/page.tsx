'use client';

import { useFormDraft } from '@/lib/form-draft';
import { FormDraftNotice } from '@/components/common/FormDraftNotice';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { createMilestone, type MilestoneStatus, type MilestonePriority } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { usePopupChat } from '@/contexts/PopupChatContext';
import { bilingualAria } from '@/lib/i18n/format';
import { BUILDER_BTN } from '@/components/builder/BuilderStageChrome';
import { qk } from '@/lib/query-keys';
import {
  milestoneEn,
  milestoneEl,
  useMilestonePrimaryText,
  MILESTONE_CATEGORY_KEYS,
  MILESTONE_PRIORITY_KEYS,
} from '@/lib/i18n/strings-milestones';

const CATEGORIES = ['product', 'fundraising', 'hiring', 'partnerships', 'growth', 'other'] as const;
const PRIORITIES: { value: MilestonePriority; color: string }[] = [
  { value: 'low', color: 'bg-muted text-muted-foreground' },
  { value: 'medium', color: 'bg-status-warning-bg text-status-warning ' },
  { value: 'high', color: 'bg-status-danger-bg text-status-danger ' },
];

export default function NewMilestonePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  const t = useMilestonePrimaryText();
  const { open: openAskAi } = usePopupChat();

  const collaboratorId = searchParams?.get('with') ?? searchParams?.get('collaborator') ?? '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<MilestonePriority>('medium');
  const [category, setCategory] = useState('product');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // A draft the assistant proposed (draft_milestone): the fields arrive filled
  // and the person still presses Create.
  const draft = useFormDraft('milestone', (f) => {
    if (typeof f.title === 'string') setTitle(f.title);
    if (typeof f.description === 'string') setDescription(f.description);
    if (typeof f.notes === 'string') setNotes(f.notes);
    if (typeof f.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.dueDate)) setDueDate(f.dueDate);
    if (typeof f.category === 'string' && (CATEGORIES as readonly string[]).includes(f.category)) setCategory(f.category);
    if (f.priority === 'low' || f.priority === 'medium' || f.priority === 'high') setPriority(f.priority);
  });

  const mutation = useMutation({
    mutationFn: () =>
      createMilestone({
        title: title.trim(),
        description: description.trim() || undefined,
        status: 'todo' as MilestoneStatus,
        priority,
        category,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        notes: notes.trim() || undefined,
        collaboratorId: collaboratorId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('milestones') });
      success('Milestone created', 'Added to your tracker.');
      router.push('/milestones');
    },
    onError: () => {
      showError('Failed to create milestone', 'Please try again');
    },
  });

  const canSubmit = title.trim().length > 0 && !mutation.isPending;

  return (
    <AppShell
      showHelp
      askAi="Propose the next Harbor milestone from Idea Core, the GTM board, or the $750K seed (Athens Tech Angels, $375K committed)."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className={`gap-1.5 ${BUILDER_BTN}`} onClick={() => openAskAi()}>
            <CfbGlyph name="spark" className="icon-sm" />
            <BilingualText en={milestoneEn('ask_ai')} el={milestoneEl('ask_ai')} compact />
          </Button>
          <Button variant="ghost" size="sm" className={`gap-2 ${BUILDER_BTN}`} aria-label={bilingualAria(milestoneEn('back'), milestoneEl('back'))} asChild>
            <Link href="/milestones">
              <ArrowLeft className="icon-sm" />
              <BilingualText en={milestoneEn('back')} el={milestoneEl('back')} compact />
            </Link>
          </Button>
        </div>
      }
      contentClassName="builder-copy overflow-x-clip"
    >
      <div className="max-w-2xl space-y-6">
        <p className="text-sm text-muted-foreground">
          <BilingualText en={milestoneEn('page_new_lead')} el={milestoneEl('page_new_lead')} />
        </p>
        <FormDraftNotice filled={draft.filled} onDismiss={draft.dismiss} />
        <Card className="rounded-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CfbGlyph name="flag" className="icon-md shrink-0 text-muted-foreground" />
              <div>
                <CardTitle>
                  <BilingualText en={milestoneEn('create_title')} el={milestoneEl('create_title')} />
                </CardTitle>
                <CardDescription className="type-identity">
                  {collaboratorId
                    ? <BilingualText en={milestoneEn('create_shared')} el={milestoneEl('create_shared')} />
                    : <BilingualText en={milestoneEn('create_solo')} el={milestoneEl('create_solo')} />}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) mutation.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="title">
                  <BilingualText en={milestoneEn('field_title')} el={milestoneEl('field_title')} compact /> <span className="text-destructive-accessible">*</span>
                </Label>
                <Input
                  id="title"
                  className="rounded-xl"
                  placeholder={t(milestoneEn('title_ph'), milestoneEl('title_ph'))}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  maxLength={140}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">
                  <BilingualText en={milestoneEn('field_desc')} el={milestoneEl('field_desc')} compact />
                </Label>
                <Textarea
                  id="description"
                  className="rounded-xl"
                  placeholder={t(milestoneEn('desc_ph'), milestoneEl('desc_ph'))}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p id="page-cap1-cap" className="text-sm font-medium leading-tight"><BilingualText en={milestoneEn('field_category')} el={milestoneEl('field_category')} compact /></p>
                  <div role="group" aria-labelledby="page-cap1-cap" className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                          category === c
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-muted-foreground hover:border-primary/50',
                        )}
                      >
                        <BilingualText en={milestoneEn(MILESTONE_CATEGORY_KEYS[c])} el={milestoneEl(MILESTONE_CATEGORY_KEYS[c])} compact />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p id="page-cap2-cap" className="text-sm font-medium leading-tight"><BilingualText en={milestoneEn('field_priority')} el={milestoneEl('field_priority')} compact /></p>
                  <div role="group" aria-labelledby="page-cap2-cap" className="flex gap-1.5">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPriority(p.value)}
                        className={cn(
                          'flex-1 rounded-xl border px-2 py-1.5 text-xs font-medium transition-all',
                          priority === p.value
                            ? `${p.color} border-transparent ring-2 ring-primary/30`
                            : 'border-border bg-background text-muted-foreground hover:border-primary/40',
                        )}
                      >
                        <BilingualText en={milestoneEn(MILESTONE_PRIORITY_KEYS[p.value])} el={milestoneEl(MILESTONE_PRIORITY_KEYS[p.value])} compact />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dueDate">
                  <BilingualText en={milestoneEn('due_optional')} el={milestoneEl('due_optional')} compact />
                </Label>
                <Input
                  id="dueDate"
                  className="rounded-xl"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">
                  <BilingualText en={milestoneEn('field_notes')} el={milestoneEl('field_notes')} compact />
                </Label>
                <Textarea
                  id="notes"
                  className="rounded-xl"
                  placeholder={t(milestoneEn('notes_ph'), milestoneEl('notes_ph'))}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={1000}
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border pt-2">
                <Button type="button" variant="ghost" className="rounded-xl" asChild>
                  <Link href="/milestones">
                    <BilingualText en={milestoneEn('cancel')} el={milestoneEl('cancel')} compact />
                  </Link>
                </Button>
                <Button type="submit" className={BUILDER_BTN} disabled={!canSubmit}>
                  {mutation.isPending
                    ? <BilingualText en={milestoneEn('creating')} el={milestoneEl('creating')} compact />
                    : <BilingualText en={milestoneEn('create')} el={milestoneEl('create')} compact />}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
