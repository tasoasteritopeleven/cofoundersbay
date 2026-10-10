'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Search, UserRound, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BilingualText } from '@/components/common/BilingualText';
import { CardHead } from '@/components/common/CardAnatomy';
import { useToast } from '@/components/ui/toast';
import { bilingualInline } from '@/lib/i18n/format';
import { useBilingualString } from '@/lib/i18n/LanguagePreferenceContext';
import { createEndorsement, searchProfiles, type SearchHit } from '@/lib/api';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';

/**
 * Writing an endorsement for someone.
 *
 * The endpoint and the client function both existed — `POST /endorsements` and
 * `createEndorsement` — and the two buttons that should have opened this did
 * nothing at all, so the page could show endorsements, approve them and
 * decline them, but never produce one.
 *
 * The constraints here are the server's own, not invented: content is 10–1000
 * characters and `toUserId` must be a real id, which is why the recipient is
 * chosen from search rather than typed. Failing in the browser on the same
 * rules the API enforces means a rejection is something the writer can see and
 * fix before they lose what they wrote.
 */

const MIN_CONTENT = 10;
const MAX_CONTENT = 1000;
const MAX_SKILL = 100;
const MAX_RELATIONSHIP = 100;

/** Offered as one tap each, because most endorsements are one of these. */
const RELATIONSHIPS: { en: string; el: string }[] = [
  { en: 'Worked together', el: 'Συνεργαστήκαμε' },
  { en: 'Co-founder', el: 'Συνιδρυτής' },
  { en: 'Mentored me', el: 'Με καθοδήγησε' },
  { en: 'I mentored them', el: 'Τον/την καθοδήγησα' },
  { en: 'Client', el: 'Πελάτης' },
  { en: 'Investor', el: 'Επενδυτής' },
];

export function GiveEndorsementDialog({
  open,
  onOpenChange,
  /** Pre-selected recipient, when the page already knows who. */
  recipient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipient?: { userId: string; displayName: string; avatarUrl?: string | null; skillNames?: string[] };
}) {
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();
  // Placeholders are visible text, so they take the reader's language
  // rather than both — `bilingualInline` stays for the aria labels below,
  // where hearing both is the point.
  const say = useBilingualString();

  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<SearchHit | null>(null);
  const [skill, setSkill] = useState('');
  const [relationship, setRelationship] = useState('');
  const [content, setContent] = useState('');

  // A fresh dialog every time it opens: a half-written endorsement for one
  // person must not reappear under another's name.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSkill('');
    setRelationship('');
    setContent('');
    setPicked(
      recipient
        ? ({
            userId: recipient.userId,
            displayName: recipient.displayName,
            avatarUrl: recipient.avatarUrl ?? null,
            skillNames: recipient.skillNames ?? [],
          } as SearchHit)
        : null,
    );
  }, [open, recipient]);

  // Only searches once there is enough to search for, and only while the
  // recipient is still unchosen.
  const trimmedQuery = query.trim();
  const { data: results, isFetching } = useQuery({
    queryKey: qk('endorsement-recipient-search', trimmedQuery),
    queryFn: () => searchProfiles({ q: trimmedQuery, limit: 6 }),
    enabled: open && !picked && trimmedQuery.length >= 2,
    staleTime: 60_000,
  });

  const suggestedSkills = useMemo(
    () => (picked?.skillNames ?? []).slice(0, 6),
    [picked],
  );

  const trimmedContent = content.trim();
  const tooShort = trimmedContent.length > 0 && trimmedContent.length < MIN_CONTENT;
  const canSubmit = !!picked && trimmedContent.length >= MIN_CONTENT && trimmedContent.length <= MAX_CONTENT;

  const submit = useMutation({
    mutationFn: () =>
      createEndorsement({
        toUserId: picked!.userId,
        content: trimmedContent,
        ...(skill.trim() ? { skill: skill.trim() } : {}),
        ...(relationship.trim() ? { relationship: relationship.trim() } : {}),
      }),
    onSuccess: () => {
      // Everything keyed under 'endorsements' — the received list, the given
      // list and the stats header all move when one is written.
      void qc.invalidateQueries({ queryKey: qk('endorsements') });
      success(
        bilingualInline('Endorsement sent', 'Η σύσταση στάλθηκε'),
        bilingualInline(
          `${picked?.displayName ?? 'They'} approves it before it appears on their profile.`,
          `Ο/Η ${picked?.displayName ?? ''} την εγκρίνει πριν εμφανιστεί στο προφίλ.`,
        ),
      );
      onOpenChange(false);
    },
    onError: (err) => {
      toastError(
        bilingualInline('Could not send the endorsement', 'Δεν στάλθηκε η σύσταση'),
        err instanceof Error ? err.message : undefined,
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <BilingualText en="Give an endorsement" el="Δώστε μια σύσταση" />
          </DialogTitle>
          <DialogDescription>
            <BilingualText
              en="Say what you saw them do. They approve it before it appears on their profile."
              el="Πείτε τι τους είδατε να κάνουν. Την εγκρίνουν πριν εμφανιστεί στο προφίλ τους."
            />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Who ── */}
          <div className="space-y-2">
            <label htmlFor="endorse-who" className="text-sm font-medium">
              <BilingualText en="Who" el="Ποιον" compact />
            </label>

            {picked ? (
              /* The person as their card shows them (ApplyModal's summary):
                 the mark, the name with the headline under it, and the one
                 control at the head's right. */
              <div className="rounded-xl border border-border p-4">
                <CardHead
                  titleAs="p"
                  mark={(
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={picked.avatarUrl ?? undefined} alt="" />
                      <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">{picked.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                  title={picked.displayName}
                  subtitle={picked.headline || undefined}
                  // The recipient is changeable unless the page fixed it.
                  aside={!recipient ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={bilingualInline('Choose someone else', 'Επιλογή άλλου ατόμου')}
                      onClick={() => setPicked(null)}
                    >
                      <X className="icon-sm" />
                    </Button>
                  ) : undefined}
                  asideStays
                />
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
                  <Input
                    id="endorse-who"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                    placeholder={say('Search by name', 'Αναζήτηση με όνομα')}
                    autoComplete="off"
                  />
                </div>

                {trimmedQuery.length >= 2 && (
                  <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-border p-1">
                    {isFetching && (
                      <p className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                        <Loader2 className="icon-sm animate-spin" />
                        <BilingualText en="Searching…" el="Αναζήτηση…" compact />
                      </p>
                    )}
                    {!isFetching && !results?.hits?.length && (
                      <p className="p-2 text-xs text-muted-foreground">
                        <BilingualText en="Nobody by that name." el="Κανείς με αυτό το όνομα." />
                      </p>
                    )}
                    {results?.hits?.map((hit) => (
                      <button
                        key={hit.userId}
                        type="button"
                        onClick={() => setPicked(hit)}
                        className="flex w-full min-h-11 items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-secondary/60 focus-ring"
                      >
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={hit.avatarUrl ?? undefined} alt="" />
                          <AvatarFallback>{hit.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{hit.displayName}</span>
                          {hit.headline && (
                            <span className="block truncate text-xs text-muted-foreground">{hit.headline}</span>
                          )}
                        </span>
                        <UserRound className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── For what ── */}
          <div className="space-y-2">
            <label htmlFor="endorse-skill" className="text-sm font-medium">
              <BilingualText en="For what (optional)" el="Για τι (προαιρετικό)" compact />
            </label>
            <Input
              id="endorse-skill"
              value={skill}
              maxLength={MAX_SKILL}
              onChange={(e) => setSkill(e.target.value)}
              placeholder={say('A skill, e.g. Fundraising', 'Μια δεξιότητα, π.χ. Χρηματοδότηση')}
            />
            {suggestedSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestedSkills.map((s) => (
                  <button key={s} type="button" onClick={() => setSkill(s)} className="focus-ring rounded-full">
                    <Badge
                      variant={skill === s ? 'default' : 'secondary'}
                      className="cursor-pointer"
                    >
                      {s}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── How you know them ── */}
          <div className="space-y-2">
            <span className="text-sm font-medium">
              <BilingualText en="How you know them (optional)" el="Πώς τους γνωρίζετε (προαιρετικό)" compact />
            </span>
            <div className="flex flex-wrap gap-1.5">
              {RELATIONSHIPS.map((r) => {
                const active = relationship === r.en;
                return (
                  <Button
                    key={r.en}
                    type="button"
                    size="xs"
                    variant={active ? 'default' : 'outline'}
                    onClick={() => setRelationship(active ? '' : r.en)}
                  >
                    <BilingualText en={r.en} el={r.el} compact />
                  </Button>
                );
              })}
            </div>
          </div>

          {/* ── What you saw ── */}
          <div className="space-y-2">
            <label htmlFor="endorse-content" className="text-sm font-medium">
              <BilingualText en="What you saw them do" el="Τι τους είδατε να κάνουν" compact />
            </label>
            <Textarea
              id="endorse-content"
              value={content}
              maxLength={MAX_CONTENT}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[110px]"
              placeholder={say(
                'Be specific — one thing they did, and what it changed.',
                'Συγκεκριμένα — ένα πράγμα που έκαναν και τι άλλαξε.',
              )}
              aria-describedby="endorse-count"
            />
            <p
              id="endorse-count"
              className={cn('text-xs tabular-nums', tooShort ? 'text-status-warning' : 'text-muted-foreground')}
            >
              {tooShort ? (
                <BilingualText
                  en={`${MIN_CONTENT - trimmedContent.length} more characters needed`}
                  el={`Χρειάζονται ${MIN_CONTENT - trimmedContent.length} χαρακτήρες ακόμη`}
                  compact
                />
              ) : (
                `${trimmedContent.length} / ${MAX_CONTENT}`
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            <BilingualText en="Cancel" el="Ακύρωση" compact />
          </Button>
          <Button type="button" disabled={!canSubmit || submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? (
              <Loader2 className="icon-sm mr-1.5 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="icon-sm mr-1.5" aria-hidden="true" />
            )}
            <BilingualText en="Send endorsement" el="Αποστολή σύστασης" compact />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
