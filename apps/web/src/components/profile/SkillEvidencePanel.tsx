'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { SKILL_EVIDENCE_COPY, SKILL_EVIDENCE_LIMITS } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { commitmentRefusal } from '@/lib/commitments-api';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { qk } from '@/lib/query-keys';
import { getEvidenceCandidates, getSkillEvidence, linkSkillEvidence, unlinkSkillEvidence, type SkillWithEvidence } from '@/lib/skill-evidence-api';

/**
 * Skills with the evidence behind them: where each one was applied here (a
 * completed milestone, a builder document, an agreed commitment) and how many
 * approved endorsements name it, with how many of those come from a
 * relationship the platform can see. On one's own profile each skill can be
 * linked to one's own completed work; the server checks the link.
 */
export function SkillEvidencePanel({ userId, editable = false }: { userId: string; editable?: boolean }) {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();
  const { primary } = useLanguagePreference();
  const skills = useQuery({ queryKey: qk('skill-evidence', userId), queryFn: () => getSkillEvidence(userId), enabled: !!userId });
  const candidates = useQuery({ queryKey: qk('skill-evidence', 'candidates'), queryFn: getEvidenceCandidates, enabled: editable });
  const [adding, setAdding] = useState<string | null>(null);
  const [choice, setChoice] = useState('');
  const [problem, setProblem] = useState<{ en: string; el: string } | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: qk('skill-evidence') });
  const link = useMutation({
    mutationFn: ({ skillName, key }: { skillName: string; key: string }) => {
      const [kind, ...rest] = key.split(':');
      return linkSkillEvidence({ skillName, kind: kind as 'milestone' | 'builder_document' | 'agreement', refId: rest.join(':') });
    },
    onSuccess: () => {
      setAdding(null);
      setChoice('');
      setProblem(null);
      void refresh();
    },
    onError: (err) => {
      const r = commitmentRefusal(err);
      setProblem({ en: r.en, el: r.el });
    },
  });
  const unlink = useMutation({ mutationFn: (id: string) => unlinkSkillEvidence(id), onSuccess: () => void refresh(), onError: () => showError('Could not remove it') });

  const list = (skills.data ?? []).filter((s) => editable || s.evidence.length > 0 || s.endorsements > 0);
  if (!skills.isLoading && !list.length && !editable) return null;

  const summary = (s: SkillWithEvidence) => {
    if (!s.endorsements) return null;
    return (
      <BilingualText
        en={`${s.endorsements} endorsement${s.endorsements === 1 ? '' : 's'}${s.verifiedEndorsements ? `, ${s.verifiedEndorsements} from work done together` : ''}`}
        el={`${s.endorsements} ${s.endorsements === 1 ? 'σύσταση' : 'συστάσεις'}${s.verifiedEndorsements ? `, ${s.verifiedEndorsements} από κοινή δουλειά` : ''}`}
        compact
      />
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base"><BilingualText en="Skills with evidence" el="Δεξιότητες με τεκμήρια" compact /></CardTitle>
        <CardDescription>
          <BilingualText
            en={editable ? 'Show where each skill was applied here. Only your own completed work can be linked.' : 'Where each skill was applied on CoFounderBay.'}
            el={editable ? 'Δείξτε πού εφαρμόστηκε κάθε δεξιότητα εδώ. Συνδέεται μόνο δική σας ολοκληρωμένη δουλειά.' : 'Πού εφαρμόστηκε κάθε δεξιότητα στο CoFounderBay.'}
            wrap
          />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!list.length ? (
          <p className="text-sm text-muted-foreground"><BilingualText en="Add skills to your profile to link evidence to them." el="Προσθέστε δεξιότητες στο προφίλ σας για να συνδέσετε τεκμήρια." wrap /></p>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((s) => (
              <li key={s.name} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{summary(s)}</span>
                </div>
                {s.evidence.length ? (
                  <ul className="space-y-1">
                    {s.evidence.map((e) => (
                      <li key={e.id} className="flex items-start justify-between gap-2 text-sm">
                        <span className="min-w-0 text-muted-foreground">
                          <BilingualText en={SKILL_EVIDENCE_COPY[e.kind].en} el={SKILL_EVIDENCE_COPY[e.kind].el} compact />: <span className="text-foreground">{e.label}</span>
                        </span>
                        {editable ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            disabled={unlink.isPending}
                            aria-label={`Remove evidence: ${e.label} · Αφαίρεση τεκμηρίου`}
                            title="Remove · Αφαίρεση"
                            onClick={() => unlink.mutate(e.id)}
                          >
                            <X className="icon-sm" aria-hidden="true" />
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : editable ? (
                  <p className="text-xs text-muted-foreground"><BilingualText en="No evidence linked yet." el="Δεν έχει συνδεθεί τεκμήριο ακόμη." compact /></p>
                ) : null}
                {editable && s.evidence.length < SKILL_EVIDENCE_LIMITS.perSkill ? (
                  adding === s.name ? (
                    <form
                      className="flex flex-col gap-2 sm:flex-row sm:items-end"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (choice) link.mutate({ skillName: s.name, key: choice });
                      }}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <Label htmlFor={`evidence-${s.name}`} className="text-xs"><BilingualText en="Completed work" el="Ολοκληρωμένη δουλειά" compact /></Label>
                        <select id={`evidence-${s.name}`} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={choice} onChange={(e) => setChoice(e.target.value)}>
                          <option value="">—</option>
                          {(candidates.data ?? []).map((c) => (
                            <option key={`${c.kind}:${c.refId}`} value={`${c.kind}:${c.refId}`}>
                              {`${primary === 'el' ? SKILL_EVIDENCE_COPY[c.kind].el : SKILL_EVIDENCE_COPY[c.kind].en}: ${c.label}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={!choice || link.isPending}><BilingualText en="Link" el="Σύνδεση" compact /></Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(null)}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
                      </div>
                    </form>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => { setAdding(s.name); setChoice(''); setProblem(null); }}>
                      <BilingualText en="Add evidence" el="Προσθήκη τεκμηρίου" compact />
                    </Button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {editable && candidates.data && !candidates.data.length ? (
          <p className="text-xs text-muted-foreground"><BilingualText en="Complete a milestone, write a builder document or agree terms on a commitment, and it can be linked here." el="Ολοκληρώστε ένα ορόσημο, γράψτε ένα έγγραφο στον builder ή συμφωνήστε όρους σε μια δέσμευση, και θα μπορεί να συνδεθεί εδώ." wrap /></p>
        ) : null}
        {problem ? <p role="alert" className="text-sm text-destructive-accessible"><BilingualText en={problem.en} el={problem.el} wrap /></p> : null}
      </CardContent>
    </Card>
  );
}
