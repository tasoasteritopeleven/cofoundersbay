'use client';

import { BilingualText } from '@/components/common/BilingualText';
import { useState } from 'react';
import {
  Filter,
  X,
  ChevronDown,
  MapPin,
  Clock,
  Briefcase,
  Target,
  Languages,
  DollarSign,
  Users,
  Sparkles,
  Search,
  Bookmark,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';
import type { NaturalFilter } from '@cofounderbay/shared';

export type SearchFiltersValues = {
  q: string;
  role: string[];
  skills: string[];
  industries: string[];
  stage: string[];
  location: string;
  remote: boolean | null;
  availability: string[];
  fundingStage: string[];
  languages: string[];
  sortBy: 'relevance' | 'recent' | 'active';
};

type SearchFiltersProps = {
  filters: SearchFiltersValues;
  onFiltersChange: (filters: SearchFiltersValues) => void;
  onSearch: () => void;
  loading?: boolean;
  resultCount?: number;
  onSaveSearch?: () => void;
  /** What the last Enter read out of the words typed, if anything. */
  interpreted?: readonly NaturalFilter[];
  /** Puts the words back as typed and drops what was read from them. */
  onSearchAsTyped?: () => void;
};

const roles = [
  { value: 'founder', label: 'Founder', labelEl: 'Ιδρυτής' },
  { value: 'mentor', label: 'Mentor', labelEl: 'Μέντορας' },
  { value: 'investor', label: 'Investor', labelEl: 'Επενδυτής' },
  { value: 'org', label: 'Organization', labelEl: 'Οργανισμός' },
];

const stages = [
  { value: 'idea', label: 'Idea Stage' },
  { value: 'mvp', label: 'MVP' },
  { value: 'traction', label: 'Traction' },
  { value: 'scaling', label: 'Scaling' },
];

const industries = [
  'AI/ML', 'Fintech', 'Healthtech', 'E-commerce', 'SaaS', 'Marketplace',
  'Gaming', 'Education', 'Climate', 'Web3/Crypto', 'Hardware', 'Consumer',
  'Enterprise', 'Social', 'Media', 'Other',
];

const availabilities = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'weekends', label: 'Weekends only' },
  { value: 'flexible', label: 'Flexible' },
];

const fundingStages = [
  { value: 'pre-seed', label: 'Pre-seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series-a', label: 'Series A' },
  { value: 'series-b', label: 'Series B+' },
  { value: 'bootstrapped', label: 'Bootstrapped' },
];

const commonSkills = [
  'Product', 'Engineering', 'Design', 'Marketing', 'Sales',
  'Operations', 'Finance', 'Legal', 'Data Science', 'Growth',
];

const languageOptions = [
  'English', 'Greek', 'Spanish', 'French', 'German', 
  'Chinese', 'Hindi', 'Arabic', 'Portuguese', 'Japanese',
];

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: { value: string; label: string }[] | string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}) {
  const normalizedOptions = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {normalizedOptions.map((opt) => (
        <button
          key={opt.value}
          onClick={() => toggle(opt.value)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs transition-colors',
            selected.includes(opt.value)
              ? 'border-primary bg-primary/10 text-primary-accessible'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function SearchFilters({
  filters,
  onFiltersChange,
  onSearch,
  loading,
  resultCount,
  onSaveSearch,
  interpreted,
  onSearchAsTyped,
}: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = <K extends keyof SearchFiltersValues>(
    key: K,
    value: SearchFiltersValues[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      q: '',
      role: [],
      skills: [],
      industries: [],
      stage: [],
      location: '',
      remote: null,
      availability: [],
      fundingStage: [],
      languages: [],
      sortBy: 'relevance',
    });
  };

  const activeFiltersCount = [
    filters.role.length,
    filters.skills.length,
    filters.industries.length,
    filters.stage.length,
    filters.location ? 1 : 0,
    filters.remote !== null ? 1 : 0,
    filters.availability.length,
    filters.fundingStage.length,
    filters.languages.length,
  ].reduce((a, b) => a + b, 0);

  // Active filter pills
  const activeFilterPills: { key: string; label: string; onRemove: () => void }[] = [];
  
  filters.role.forEach((r) => {
    activeFilterPills.push({
      key: `role-${r}`,
      label: roles.find((x) => x.value === r)?.label || r,
      onRemove: () => updateFilter('role', filters.role.filter((x) => x !== r)),
    });
  });

  filters.skills.forEach((s) => {
    activeFilterPills.push({
      key: `skill-${s}`,
      label: s,
      onRemove: () => updateFilter('skills', filters.skills.filter((x) => x !== s)),
    });
  });

  filters.industries.forEach((ind) => {
    activeFilterPills.push({
      key: `industry-${ind}`,
      label: ind,
      onRemove: () => updateFilter('industries', filters.industries.filter((x) => x !== ind)),
    });
  });

  return (
    <div className="space-y-4">
      {/* Main search bar */}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:gap-3">
        <div className="flex min-w-0 flex-1 gap-2">
          <div className="relative min-w-0 flex-1">
            <Input
              type="text"
              aria-label={bilingualAria("Search profiles", "Αναζήτηση προφίλ")}
              placeholder={bilingualInline("Name, skill, or e.g. cofounder SaaS Athens full-time", "Όνομα, δεξιότητα ή π.χ. συνιδρυτής SaaS Αθήνα πλήρης απασχόληση")}
              value={filters.q}
              onChange={(e) => updateFilter('q', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              className="min-h-10 pr-10"
              data-filter-field=""
            />
            {filters.q && (
              <button
                onClick={() => updateFilter('q', '')}
                className="absolute right-2 top-1/2 inline-flex tap-target -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="icon-sm" />
              </button>
            )}
          </div>

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              {/* Same shape as the feed's Preferences button: the word "Filters"
                  is `hidden sm:inline`, so below 640px the only thing left in
                  the button was the active-filter count — a number, which is
                  not a name. */}
              <Button
                variant="outline"
                aria-label="Filters"
                className="relative min-h-10 shrink-0 gap-2 px-3"
              >
                <Filter className="icon-sm" aria-hidden="true" />
                <span className="hidden sm:inline"><BilingualText en="Filters" el="Φίλτρα" compact /></span>
                {activeFiltersCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center p-0 text-2xs">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Filter className="icon-md text-muted-foreground" />
                Search Filters
              </SheetTitle>
              <SheetDescription className="sr-only"><BilingualText en="Refine search results by role, skills and other criteria." el="Περιορίστε τα αποτελέσματα αναζήτησης με ρόλο, δεξιότητες και άλλα κριτήρια." /></SheetDescription>
            </SheetHeader>

            <Accordion type="multiple" defaultValue={['role', 'skills']} className="mt-6">
              {/* Role */}
              <AccordionItem value="role">
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="icon-sm" />
                    Role
                    {filters.role.length > 0 && (
                      <Badge variant="secondary" size="sm">{filters.role.length}</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <MultiSelect
                    options={roles}
                    selected={filters.role}
                    onChange={(v) => updateFilter('role', v)}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Skills */}
              <AccordionItem value="skills">
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <Sparkles className="icon-sm" />
                    Skills
                    {filters.skills.length > 0 && (
                      <Badge variant="secondary" size="sm">{filters.skills.length}</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <MultiSelect
                    options={commonSkills}
                    selected={filters.skills}
                    onChange={(v) => updateFilter('skills', v)}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Industry */}
              <AccordionItem value="industry">
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <Briefcase className="icon-sm" />
                    Industry
                    {filters.industries.length > 0 && (
                      <Badge variant="secondary" size="sm">{filters.industries.length}</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <MultiSelect
                    options={industries}
                    selected={filters.industries}
                    onChange={(v) => updateFilter('industries', v)}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Stage */}
              <AccordionItem value="stage">
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <Target className="icon-sm" />
                    Startup Stage
                    {filters.stage.length > 0 && (
                      <Badge variant="secondary" size="sm">{filters.stage.length}</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <MultiSelect
                    options={stages}
                    selected={filters.stage}
                    onChange={(v) => updateFilter('stage', v)}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Location */}
              <AccordionItem value="location">
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="icon-sm" />
                    Location
                    {filters.location && <Badge variant="secondary" size="sm">1</Badge>}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <Input
                    placeholder={bilingualInline("City or country…", "Πόλη ή χώρα…")}
                    value={filters.location}
                    onChange={(e) => updateFilter('location', e.target.value)}
                  />
                  <div className="flex gap-2">
                    {['Remote OK', 'On-site only'].map((opt, i) => (
                      <button
                        key={opt}
                        onClick={() => updateFilter('remote', i === 0 ? true : false)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs transition-colors',
                          (i === 0 && filters.remote === true) || (i === 1 && filters.remote === false)
                            ? 'border-primary bg-primary/10 text-primary-accessible'
                            : 'border-border text-muted-foreground hover:border-primary/50'
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Availability */}
              <AccordionItem value="availability">
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="icon-sm" />
                    Availability
                    {filters.availability.length > 0 && (
                      <Badge variant="secondary" size="sm">{filters.availability.length}</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <MultiSelect
                    options={availabilities}
                    selected={filters.availability}
                    onChange={(v) => updateFilter('availability', v)}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Funding Stage */}
              <AccordionItem value="funding">
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="icon-sm" />
                    Funding Stage
                    {filters.fundingStage.length > 0 && (
                      <Badge variant="secondary" size="sm">{filters.fundingStage.length}</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <MultiSelect
                    options={fundingStages}
                    selected={filters.fundingStage}
                    onChange={(v) => updateFilter('fundingStage', v)}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Languages */}
              <AccordionItem value="languages">
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <Languages className="icon-sm" />
                    Languages
                    {filters.languages.length > 0 && (
                      <Badge variant="secondary" size="sm">{filters.languages.length}</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <MultiSelect
                    options={languageOptions}
                    selected={filters.languages}
                    onChange={(v) => updateFilter('languages', v)}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <SheetFooter className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button variant="ghost" onClick={clearFilters} className="min-h-10 flex-1">
                Clear all
              </Button>
              <Button onClick={() => { onSearch(); setIsOpen(false); }} className="min-h-10 flex-1">
                Apply filters
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        </div>

        <Button onClick={onSearch} disabled={loading} className="min-h-10 w-full gap-2 sm:w-auto">
          <Search className="h-4 w-4 sm:hidden" />
          {loading ? 'Searching...' : 'Search'}
        </Button>
        {onSaveSearch && (
          <Button variant="outline" onClick={onSaveSearch} className="min-h-10 w-full gap-2 sm:w-auto">
            <Bookmark className="icon-sm" aria-hidden="true" />
            <BilingualText en="Save search" el="Αποθήκευση αναζήτησης" compact />
          </Button>
        )}
      </div>

      {/* What Enter read out of the words typed, and the way back to them. */}
      {interpreted && interpreted.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/15 bg-primary/[0.03] px-3 py-2" role="status">
          <span className="text-sm text-muted-foreground">
            <BilingualText en="Read as filters:" el="Διαβάστηκε ως φίλτρα:" compact />
          </span>
          {interpreted.map((f) => (
            <Badge key={`${f.kind}-${f.value}`} variant="secondary">
              <BilingualText en={f.en} el={f.el} compact />
            </Badge>
          ))}
          {onSearchAsTyped && (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={onSearchAsTyped}>
              <BilingualText en="Search the words as typed" el="Αναζήτηση όπως γράφτηκε" compact />
            </Button>
          )}
        </div>
      )}

      {/* Quick role filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* "Search only", not "Quick filter": the role chips above this row
            narrow the results on screen, while these change the query sent to
            the search - two rows of the same roles need to say which is which. */}
        <span className="text-sm text-muted-foreground">
          <BilingualText en="Search only:" el="Αναζήτηση μόνο σε:" compact />
        </span>
        {roles.map((r) => (
          <Button
            key={r.value}
            variant={filters.role.includes(r.value) ? 'default' : 'outline'}
            size="sm"
            className="min-h-10"
            onClick={() => {
              if (filters.role.includes(r.value)) {
                updateFilter('role', filters.role.filter((x) => x !== r.value));
              } else {
                updateFilter('role', [...filters.role, r.value]);
              }
            }}
          >
            <BilingualText en={r.label} el={r.labelEl} compact />
          </Button>
        ))}
      </div>

      {/* Active filter pills */}
      {activeFilterPills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground"><BilingualText en="Active:" el="Ενεργά:" compact /></span>
          {activeFilterPills.slice(0, 10).map((pill) => (
            <Badge
              key={pill.key}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {pill.label}
              <button aria-label={`Remove filter ${pill.label}`} type="button"
                onClick={pill.onRemove}
                className="ml-1 rounded-full p-0.5 hover:bg-background/50"
              >
                <X className="icon-sm" />
              </button>
            </Badge>
          ))}
          {activeFilterPills.length > 10 && (
            <span className="text-xs text-muted-foreground">
              +{activeFilterPills.length - 10} more
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      )}

      {/* Results count & sort */}
      {resultCount !== undefined && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            <BilingualText
              en={`${resultCount} ${resultCount === 1 ? 'result' : 'results'} found`}
              el={`${resultCount} ${resultCount === 1 ? 'αποτέλεσμα' : 'αποτελέσματα'}`}
              compact
            />
          </span>
          <select
            aria-label={bilingualAria('Sort results', 'Ταξινόμηση αποτελεσμάτων')}
            value={filters.sortBy}
            onChange={(e) => updateFilter('sortBy', e.target.value as SearchFiltersValues['sortBy'])}
            className="h-8 rounded-md border border-input bg-background/60 px-2 text-xs text-foreground backdrop-blur"
            data-filter-field=""
          >
            <option value="relevance">Most relevant</option>
            <option value="recent">Recently active</option>
            <option value="active">Most active</option>
          </select>
        </div>
      )}
    </div>
  );
}
