'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  educationFromLinkedIn,
  experienceFromLinkedIn,
  experienceSummary,
  hasLinkedInData,
  readEducation,
  readExperience,
  type EducationEntry,
  type ExperienceEntry,
  type LinkedInImport,
} from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { getProfileImportStatus, startProfileImport } from '@/lib/linkedin-import/api';
import { readLinkedInFiles } from '@/lib/linkedin-import/read-files';
import { qk } from '@/lib/query-keys';

export interface ImportableProfile {
  displayName: string;
  headline: string;
  bio: string;
  location: string;
  websiteUrl: string;
  skills: string[];
  /** Structured roles for the profile's Experience section. */
  experience?: ExperienceEntry[];
  education?: EducationEntry[];
}

const sameRole = (a: ExperienceEntry, b: ExperienceEntry) => a.title.toLowerCase() === b.title.toLowerCase() && a.company.toLowerCase() === b.company.toLowerCase();
const sameSchool = (a: EducationEntry, b: EducationEntry) => a.school.toLowerCase() === b.school.toLowerCase() && a.degree.toLowerCase() === b.degree.toLowerCase();

type FieldKey = 'displayName' | 'headline' | 'bio' | 'location' | 'websiteUrl' | 'skills';
const LABELS: Record<FieldKey, { en: string; el: string }> = {
  displayName: { en: 'Name', el: 'Όνομα' },
  headline: { en: 'Headline', el: 'Τίτλος' },
  bio: { en: 'About', el: 'Σχετικά' },
  location: { en: 'Location', el: 'Τοποθεσία' },
  websiteUrl: { en: 'Website', el: 'Ιστότοπος' },
  skills: { en: 'Skills', el: 'Δεξιότητες' },
};

/**
 * "Import from LinkedIn" on the profile editor.
 *
 * Two ways in: the member's own data export (ZIP or CSV files), read in the
 * browser so nothing is uploaded; or, where the server has it, LinkedIn's DMA
 * portability API for EU members. Either way the result is a preview of the
 * fields it would fill, each one optional, and "Fill the form" only fills the
 * form: nothing is saved until the person presses Save.
 */
export function LinkedInImportDialog({
  open,
  onOpenChange,
  current,
  skillCatalog,
  initial,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: ImportableProfile;
  skillCatalog: readonly string[];
  /** A result that arrived from the DMA round trip, shown straight away. */
  initial?: LinkedInImport | null;
  onApply: (fields: Partial<ImportableProfile>) => void;
}) {
  const [imp, setImp] = useState<LinkedInImport | null>(initial ?? null);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Record<FieldKey, boolean>>({ displayName: true, headline: true, bio: true, location: true, websiteUrl: true, skills: true });
  const [withExperience, setWithExperience] = useState(false);
  // Positions fill the Experience section and schools the Education section
  // unless unticked; adding them to About as text stays a separate choice.
  const [withRoles, setWithRoles] = useState(true);
  const [withSchools, setWithSchools] = useState(true);
  useEffect(() => {
    if (initial) setImp(initial);
  }, [initial]);
  const status = useQuery({ queryKey: qk('me', 'linkedin-import-status'), queryFn: getProfileImportStatus, enabled: open, staleTime: 5 * 60_000 });

  const catalog = useMemo(() => new Map(skillCatalog.map((s) => [s.toLowerCase(), s])), [skillCatalog]);
  const matchedSkills = useMemo(() => {
    const out: string[] = [];
    for (const s of imp?.skills ?? []) {
      const hit = catalog.get(s.toLowerCase());
      if (hit && !out.includes(hit) && !current.skills.some((c) => c.toLowerCase() === hit.toLowerCase())) out.push(hit);
    }
    return out;
  }, [imp, catalog, current.skills]);
  const skippedSkills = (imp?.skills.length ?? 0) - matchedSkills.length;

  const values: Partial<Record<FieldKey, string>> = imp
    ? {
        displayName: imp.displayName,
        headline: imp.headline,
        bio: [imp.bio, withExperience ? experienceSummary(imp) : ''].filter(Boolean).join('\n\n'),
        location: imp.location,
        websiteUrl: imp.websiteUrl,
        skills: matchedSkills.join(', '),
      }
    : {};
  const rows = (Object.keys(LABELS) as FieldKey[]).filter((k) => (values[k] ?? '').trim() !== '');

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setReading(true);
    setProblem(null);
    try {
      const result = await readLinkedInFiles(Array.from(list));
      if (!hasLinkedInData(result)) setProblem('none');
      setImp(result);
    } catch {
      setProblem('unreadable');
    } finally {
      setReading(false);
    }
  };

  const roles = useMemo(() => (imp ? experienceFromLinkedIn(imp) : []), [imp]);
  const schools = useMemo(() => (imp ? educationFromLinkedIn(imp) : []), [imp]);
  const newRoles = roles.filter((r) => !(current.experience ?? []).some((c) => sameRole(c, r)));
  const newSchools = schools.filter((r) => !(current.education ?? []).some((c) => sameSchool(c, r)));

  const apply = () => {
    const fields: Partial<ImportableProfile> = {};
    for (const k of rows) {
      if (!chosen[k]) continue;
      if (k === 'skills') fields.skills = [...current.skills, ...matchedSkills].slice(0, 15);
      else fields[k] = values[k] as string;
    }
    if (withRoles && newRoles.length) fields.experience = readExperience([...(current.experience ?? []), ...newRoles]);
    if (withSchools && newSchools.length) fields.education = readEducation([...(current.education ?? []), ...newSchools]);
    onApply(fields);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle><BilingualText en="Import from LinkedIn" el="Εισαγωγή από το LinkedIn" compact /></DialogTitle>
          <DialogDescription>
            <BilingualText en="Fills the form with what you choose. Nothing is saved until you press Save." el="Συμπληρώνει τη φόρμα με ό,τι επιλέξετε. Τίποτα δεν αποθηκεύεται πριν πατήσετε Αποθήκευση." wrap />
          </DialogDescription>
        </DialogHeader>

        {!imp ? (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li><BilingualText en="On LinkedIn: Settings → Data privacy → Get a copy of your data." el="Στο LinkedIn: Ρυθμίσεις → Απόρρητο δεδομένων → Λήψη αντιγράφου των δεδομένων σας." wrap /></li>
              <li><BilingualText en="Pick Profile, Positions, Education and Skills, and download the file." el="Επιλέξτε Profile, Positions, Education και Skills και κατεβάστε το αρχείο." wrap /></li>
              <li><BilingualText en="Choose the ZIP (or its CSV files) here. It is read on this device and not uploaded." el="Επιλέξτε εδώ το ZIP (ή τα CSV του). Διαβάζεται σε αυτή τη συσκευή και δεν ανεβαίνει." wrap /></li>
            </ol>
            <div className="space-y-1.5">
              <Label htmlFor="linkedin-export-files"><BilingualText en="LinkedIn data export" el="Αρχείο δεδομένων LinkedIn" compact /></Label>
              <input
                id="linkedin-export-files"
                type="file"
                accept=".zip,.csv,application/zip,text/csv"
                multiple
                disabled={reading}
                onChange={(e) => void onFiles(e.target.files)}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:text-foreground"
              />
            </div>
            {problem ? (
              <p role="alert" className="text-sm text-destructive-accessible">
                <BilingualText
                  en={problem === 'none' ? 'That file has no profile, positions or skills in it.' : 'That file could not be read. Choose the ZIP LinkedIn sent, or its CSV files.'}
                  el={problem === 'none' ? 'Το αρχείο δεν περιέχει προφίλ, θέσεις ή δεξιότητες.' : 'Το αρχείο δεν διαβάστηκε. Επιλέξτε το ZIP που έστειλε το LinkedIn ή τα CSV του.'}
                  wrap
                />
              </p>
            ) : null}
            <div className="rounded-xl border border-border p-3">
              <p className="text-sm font-medium text-foreground"><BilingualText en="In the EU: connect LinkedIn directly" el="Στην ΕΕ: απευθείας σύνδεση με LinkedIn" compact /></p>
              <p className="mt-1 text-xs text-muted-foreground">
                <BilingualText
                  en={status.data?.available ? 'Under the Digital Markets Act, LinkedIn shares your profile with your consent.' : 'Not set up on this server yet; the export above works today.'}
                  el={status.data?.available ? 'Βάσει του Digital Markets Act, το LinkedIn μοιράζεται το προφίλ σας με τη συναίνεσή σας.' : 'Δεν έχει ρυθμιστεί ακόμη σε αυτόν τον διακομιστή· το αρχείο παραπάνω λειτουργεί ήδη.'}
                  wrap
                />
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={!status.data?.available}
                title={status.data?.available ? undefined : 'Not set up on this server · Δεν έχει ρυθμιστεί σε αυτόν τον διακομιστή'}
                onClick={() => void startProfileImport().then(({ url }) => window.location.assign(url), () => setProblem('unreadable'))}
              >
                <BilingualText en="Connect LinkedIn" el="Σύνδεση με LinkedIn" compact />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground"><BilingualText en="Nothing new to fill." el="Τίποτα νέο για συμπλήρωση." compact /></p>
            ) : (
              /* One group of choices, a hairline between them, rather than a
                 frame around every field. */
              <ul className="divide-y divide-border rounded-xl border border-border px-3" aria-label="Fields to fill · Πεδία προς συμπλήρωση">
                {rows.map((k) => (
                  <li key={k} className="flex items-start gap-3 py-2.5">
                    <Checkbox id={`import-${k}`} checked={chosen[k]} onCheckedChange={(v) => setChosen((c) => ({ ...c, [k]: v === true }))} className="mt-0.5" />
                    <label htmlFor={`import-${k}`} className="min-w-0 flex-1 text-sm">
                      <span className="font-medium text-foreground"><BilingualText en={LABELS[k].en} el={LABELS[k].el} compact /></span>
                      <span className="card-body mt-0.5 block whitespace-pre-line break-words text-muted-foreground">{values[k]}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {skippedSkills > 0 ? (
              <p className="text-xs text-muted-foreground">
                <BilingualText
                  en={`${skippedSkills} LinkedIn skill${skippedSkills === 1 ? ' is' : 's are'} not in CoFounderBay’s list (or already on your profile) and ${skippedSkills === 1 ? 'is' : 'are'} left out.`}
                  el={`${skippedSkills} δεξιότητ${skippedSkills === 1 ? 'α' : 'ες'} του LinkedIn δεν ${skippedSkills === 1 ? 'είναι' : 'είναι'} στον κατάλογο του CoFounderBay (ή υπάρχουν ήδη) και μένουν εκτός.`}
                  wrap
                />
              </p>
            ) : null}
            {newRoles.length ? (
              <div className="flex items-start gap-3">
                <Checkbox id="import-roles" checked={withRoles} onCheckedChange={(v) => setWithRoles(v === true)} className="mt-0.5" />
                <label htmlFor="import-roles" className="text-sm text-foreground">
                  <BilingualText
                    en={`Add ${newRoles.length} position${newRoles.length === 1 ? '' : 's'} to Experience`}
                    el={`Προσθήκη ${newRoles.length} ${newRoles.length === 1 ? 'θέσης' : 'θέσεων'} στην «Εμπειρία»`}
                    wrap
                  />
                </label>
              </div>
            ) : null}
            {newSchools.length ? (
              <div className="flex items-start gap-3">
                <Checkbox id="import-schools" checked={withSchools} onCheckedChange={(v) => setWithSchools(v === true)} className="mt-0.5" />
                <label htmlFor="import-schools" className="text-sm text-foreground">
                  <BilingualText
                    en={`Add ${newSchools.length} school${newSchools.length === 1 ? '' : 's'} to Education`}
                    el={`Προσθήκη ${newSchools.length} ${newSchools.length === 1 ? 'σχολής' : 'σχολών'} στην «Εκπαίδευση»`}
                    wrap
                  />
                </label>
              </div>
            ) : null}
            {imp.positions.length ? (
              <div className="flex items-start gap-3">
                <Checkbox id="import-experience" checked={withExperience} onCheckedChange={(v) => setWithExperience(v === true)} className="mt-0.5" />
                <label htmlFor="import-experience" className="text-sm text-muted-foreground">
                  <BilingualText en={`Add my last ${Math.min(imp.positions.length, 4)} positions to About`} el={`Προσθήκη των τελευταίων ${Math.min(imp.positions.length, 4)} θέσεών μου στο «Σχετικά»`} wrap />
                </label>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2">
          {imp ? (
            <Button variant="ghost" onClick={() => setImp(null)}>
              <BilingualText en="Choose another file" el="Άλλο αρχείο" compact />
            </Button>
          ) : null}
          <Button onClick={apply} disabled={!imp || (rows.every((k) => !chosen[k]) && !(withRoles && newRoles.length) && !(withSchools && newSchools.length))}>
            <BilingualText en="Fill the form" el="Συμπλήρωση φόρμας" compact />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
