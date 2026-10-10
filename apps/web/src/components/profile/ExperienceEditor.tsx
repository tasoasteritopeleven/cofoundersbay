'use client';

import { useId } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { EDUCATION_MAX, EXPERIENCE_MAX, type EducationEntry, type ExperienceEntry } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';

/**
 * The editor for a profile's Experience and Education. Rows are free text with
 * a year at each end; an empty "To" means the role is current. Nothing here
 * saves: the profile form's Save sends the cleaned rows in `rolePayload`.
 */

type Field<T> = { key: keyof T; en: string; el: string; placeholder: string; year?: boolean };

const ROLE_FIELDS: Field<ExperienceEntry>[] = [
  { key: 'title', en: 'Title', el: 'Θέση', placeholder: 'Co-founder' },
  { key: 'company', en: 'Company', el: 'Εταιρεία', placeholder: 'Harbor' },
  { key: 'start', en: 'From (year)', el: 'Από (έτος)', placeholder: '2022', year: true },
  { key: 'end', en: 'To (year, empty if current)', el: 'Έως (έτος, κενό αν ισχύει)', placeholder: bilingualInline('now', 'σήμερα'), year: true },
];

const SCHOOL_FIELDS: Field<EducationEntry>[] = [
  { key: 'school', en: 'School', el: 'Σχολή', placeholder: 'NTUA' },
  { key: 'degree', en: 'Degree', el: 'Πτυχίο', placeholder: 'MEng' },
  { key: 'start', en: 'From (year)', el: 'Από (έτος)', placeholder: '2012', year: true },
  { key: 'end', en: 'To (year)', el: 'Έως (έτος)', placeholder: '2017', year: true },
];

function Rows<T extends { [K in keyof T]: string }>({
  rows,
  onChange,
  fields,
  blank,
  max,
  addEn,
  addEl,
  itemEn,
  itemEl,
}: {
  rows: T[];
  onChange: (rows: T[]) => void;
  fields: Field<T>[];
  blank: T;
  max: number;
  addEn: string;
  addEl: string;
  itemEn: string;
  itemEl: string;
}) {
  const base = useId();
  const set = (i: number, key: keyof T, value: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        // One hairline between entries; a frame per entry indented every field.
        <div key={i} className="space-y-3 border-b border-border pb-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((f) => {
              const id = `${base}-${i}-${String(f.key)}`;
              return (
                <div key={String(f.key)} className="space-y-1.5">
                  <Label htmlFor={id}><BilingualText en={f.en} el={f.el} compact /></Label>
                  <Input
                    id={id}
                    value={row[f.key] ?? ''}
                    onChange={(e) => set(i, f.key, f.year ? e.target.value.replace(/[^0-9]/g, '').slice(0, 4) : e.target.value.slice(0, 120))}
                    placeholder={f.placeholder}
                    inputMode={f.year ? 'numeric' : undefined}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              aria-label={bilingualAria(`Remove ${itemEn} ${i + 1}`, `Αφαίρεση ${itemEl} ${i + 1}`)}
            >
              <Trash2 className="icon-sm" aria-hidden="true" />
              <BilingualText en="Remove" el="Αφαίρεση" compact />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={rows.length >= max} onClick={() => onChange([...rows, { ...blank }])}>
        <Plus className="icon-sm" aria-hidden="true" />
        <BilingualText en={addEn} el={addEl} compact />
      </Button>
    </div>
  );
}

export function ExperienceEditor({
  experience,
  education,
  onExperience,
  onEducation,
}: {
  experience: ExperienceEntry[];
  education: EducationEntry[];
  onExperience: (rows: ExperienceEntry[]) => void;
  onEducation: (rows: EducationEntry[]) => void;
}) {
  return (
    <div className="space-y-6">
      <section aria-label="Experience · Εμπειρία" className="space-y-3">
        <p className="text-sm font-medium text-foreground"><BilingualText en="Experience" el="Εμπειρία" compact /></p>
        <Rows<ExperienceEntry>
          rows={experience}
          onChange={onExperience}
          fields={ROLE_FIELDS}
          blank={{ title: '', company: '', start: '', end: '' }}
          max={EXPERIENCE_MAX}
          addEn="Add a role"
          addEl="Προσθήκη ρόλου"
          itemEn="role"
          itemEl="ρόλου"
        />
      </section>
      <section aria-label="Education · Εκπαίδευση" className="space-y-3">
        <p className="text-sm font-medium text-foreground"><BilingualText en="Education" el="Εκπαίδευση" compact /></p>
        <Rows<EducationEntry>
          rows={education}
          onChange={onEducation}
          fields={SCHOOL_FIELDS}
          blank={{ school: '', degree: '', start: '', end: '' }}
          max={EDUCATION_MAX}
          addEn="Add a school"
          addEl="Προσθήκη σχολής"
          itemEn="school"
          itemEl="σχολής"
        />
      </section>
    </div>
  );
}
