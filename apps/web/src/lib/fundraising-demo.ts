export type RoundStatus = 'planning' | 'active' | 'closing' | 'closed';
export type InvestorStatus = 'prospect' | 'contacted' | 'meeting' | 'dd' | 'committed' | 'passed';
export type DocStatus = 'draft' | 'ready' | 'shared';

export type FundRound = {
  id: string;
  name: string;
  nameEl?: string;
  type: string;
  currency: string;
  target: number;
  raised: number;
  status: RoundStatus;
  closingDate?: string;
  valuation?: number;
  leadInvestor?: string;
};

export type InvestorLead = {
  id: string;
  name: string;
  nameEl?: string;
  firm?: string;
  type: string;
  stage: string;
  checkSize: string;
  checkSizeEl?: string;
  status: InvestorStatus;
  lastContact?: string;
  notes?: string;
  notesEl?: string;
  isVerified: boolean;
  href?: string;
};

export type DataRoomDoc = {
  id: string;
  name: string;
  nameEl?: string;
  category: string;
  status: DocStatus;
  isRequired: boolean;
  lastUpdated?: string;
  href?: string;
};

const STORAGE_KEY = 'cfb:demo-fundraising';

const FUNDRAISING_STALE_SNIPPETS = [
  'Sarah Chen',
  'Chen Ventures',
  'Michael Torres',
  'Horizon Capital',
  'Emma Williams',
  'Sequoia',
  'Klaus Weber',
  'Weber Family Office',
  'Customer Contracts',
  'LOIs',
  'Fortune',
];

/** Seed round — dashboard widget and /fundraising must read the same numbers. */
export const FUNDRAISING_SEED_ROUND: FundRound = {
  id: 'r1',
  name: 'Harbor $750K seed',
  nameEl: 'Γύρος Harbor $750K',
  type: 'SAFE',
  currency: '$',
  target: 750_000,
  raised: 375_000,
  status: 'active',
  closingDate: '2026-10-15T17:00:00.000Z',
  leadInvestor: 'Athens Tech Angels',
};

export const FUNDRAISING_SEED_LEADS: InvestorLead[] = [
  // The only lead with `status: 'committed'`, so the amount it commits has to
  // be the round's whole `raised` figure — the "Committed" tile totals exactly
  // this — and its cheque range has to contain that figure, in the round's own
  // currency. `firm` is omitted: "Syndicate" is the type, not a firm name.
  {
    id: 'ata',
    name: 'Athens Tech Angels',
    type: 'Syndicate',
    stage: 'Pre-Seed / Seed',
    checkSize: '$200K–$500K',
    status: 'committed',
    lastContact: '2026-09-03T12:00:00.000Z',
    isVerified: true,
    href: '/investors',
    notes: 'Lead investor — committed the full $375K raised so far.',
    notesEl: 'Κύριος επενδυτής — δεσμεύτηκε και τα $375K που έχουν συγκεντρωθεί.',
  },
  {
    id: 'athens-network',
    name: 'Warm intro from Athens founder networks',
    nameEl: 'Ζεστή γνωριμία μέσω δικτύων ιδρυτών στην Αθήνα',
    type: 'Angel',
    stage: 'Pre-Seed / Seed',
    checkSize: 'Warm intro',
    checkSizeEl: 'Ζεστή γνωριμία',
    status: 'contacted',
    lastContact: '2026-09-02T10:00:00.000Z',
    isVerified: false,
    href: '/projects/3',
    notes: 'Waiting on a warm intro from Athens and EU founder networks.',
    notesEl: 'Αναμονή ζεστής γνωριμίας μέσω δικτύων ιδρυτών στην Αθήνα και την ΕΕ.',
  },
  {
    id: 'remaining-close',
    name: 'Remaining $375K of the $750K seed',
    nameEl: 'Υπόλοιπα $375K του γύρου $750K',
    type: 'Syndicate',
    stage: 'Pre-Seed / Seed',
    checkSize: '$375K remaining',
    checkSizeEl: 'Υπόλοιπα $375K',
    status: 'meeting',
    lastContact: '2026-09-04T10:00:00.000Z',
    isVerified: false,
    href: '/builder/pitch-deck',
    notes: 'Open ask to close the remaining $375K.',
    notesEl: 'Ανοιχτό αίτημα για τα υπόλοιπα $375K.',
  },
];

export const FUNDRAISING_SEED_DOCS: DataRoomDoc[] = [
  { id: 'd1', name: 'Pitch deck for the $750K seed', nameEl: 'Pitch deck για τον γύρο $750K', category: 'Pitch', status: 'ready', isRequired: true, lastUpdated: '2026-09-03T12:00:00.000Z', href: '/builder/pitch-deck' },
  { id: 'd2', name: 'Idea Core one-pager', nameEl: 'Μονόφυλλο Πυρήνα ιδέας', category: 'Pitch', status: 'ready', isRequired: true, lastUpdated: '2026-08-30T12:00:00.000Z', href: '/builder?tab=idea-core' },
  { id: 'd3', name: 'Financials from Builder', nameEl: 'Οικονομικά από τον Builder', category: 'Financials', status: 'draft', isRequired: true, lastUpdated: '2026-09-01T12:00:00.000Z', href: '/builder?tab=financials' },
  { id: 'd4', name: 'Cap table (percentages TBD)', nameEl: 'Cap table (τα ποσοστά εκκρεμούν)', category: 'Legal', status: 'draft', isRequired: true, lastUpdated: '2026-08-23T12:00:00.000Z' },
  { id: 'd5', name: 'SAFE / term sheet for the $750K seed', nameEl: 'SAFE / φύλλο όρων για τον γύρο $750K', category: 'Legal', status: 'draft', isRequired: true, lastUpdated: undefined },
  { id: 'd6', name: 'GTM board on Research', nameEl: 'Πίνακας GTM στην Έρευνα', category: 'Market', status: 'ready', isRequired: false, lastUpdated: '2026-08-29T09:00:00.000Z', href: '/research' },
  { id: 'd7', name: 'BMC in Builder', nameEl: 'BMC στον Builder', category: 'Product', status: 'ready', isRequired: false, lastUpdated: '2026-08-28T12:00:00.000Z', href: '/builder?tab=bmc' },
  { id: 'd8', name: 'Team: Elena & complementary-cofounder role', nameEl: 'Ομάδα: Elena και ρόλος συμπληρωματικού συνιδρυτή', category: 'Team', status: 'ready', isRequired: false, lastUpdated: '2026-08-16T12:00:00.000Z', href: '/projects/1' },
  { id: 'd9', name: 'Data room note for Athens Tech Angels', nameEl: 'Σημείωμα data room για τους Athens Tech Angels', category: 'Legal', status: 'shared', isRequired: false, lastUpdated: '2026-09-03T12:00:00.000Z' },
  { id: 'd10', name: 'Remaining $375K close checklist', nameEl: 'Λίστα κλεισίματος υπόλοιπων $375K', category: 'Traction', status: 'draft', isRequired: false, lastUpdated: undefined },
];

export const PIPELINE_STAGES: InvestorStatus[] = ['prospect', 'contacted', 'meeting', 'dd', 'committed', 'passed'];
export const DOC_CATEGORIES = ['All', 'Pitch', 'Financials', 'Legal', 'Product', 'Market', 'Team', 'Traction'] as const;
export const INVESTOR_TYPES = ['Angel', 'VC', 'Syndicate', 'Scout', 'Family Office'] as const;
export const ACTIVE_STATUSES: InvestorStatus[] = ['contacted', 'meeting', 'dd'];
const DOC_STATUSES: DocStatus[] = ['draft', 'ready', 'shared'];

const SEED_LEAD_IDS = new Set(FUNDRAISING_SEED_LEADS.map((l) => l.id));
const SEED_DOC_IDS = new Set(FUNDRAISING_SEED_DOCS.map((d) => d.id));

export type FundraisingOverlay = {
  created: InvestorLead[];
  status: Record<string, InvestorStatus>;
  docsStatus: Record<string, DocStatus>;
  docsUpdated: Record<string, string>;
};

export function emptyFundraisingOverlay(): FundraisingOverlay {
  return { created: [], status: {}, docsStatus: {}, docsUpdated: {} };
}

function isInvestorStatus(value: unknown): value is InvestorStatus {
  return typeof value === 'string' && (PIPELINE_STAGES as string[]).includes(value);
}

function isDocStatus(value: unknown): value is DocStatus {
  return typeof value === 'string' && DOC_STATUSES.includes(value as DocStatus);
}

function isLeadShape(value: unknown): value is InvestorLead {
  if (!value || typeof value !== 'object') return false;
  const row = value as InvestorLead;
  return typeof row.id === 'string' && typeof row.name === 'string' && isInvestorStatus(row.status);
}

export function coerceFundraisingOverlay(parsed: Partial<FundraisingOverlay> | null | undefined): FundraisingOverlay {
  const created = Array.isArray(parsed?.created)
    ? parsed.created.filter((row) => isLeadShape(row) && !SEED_LEAD_IDS.has(row.id))
    : [];
  const knownIds = new Set([...SEED_LEAD_IDS, ...created.map((l) => l.id)]);
  const status: Record<string, InvestorStatus> = {};
  if (parsed?.status && typeof parsed.status === 'object' && !Array.isArray(parsed.status)) {
    for (const [id, value] of Object.entries(parsed.status)) {
      if (knownIds.has(id) && isInvestorStatus(value)) status[id] = value;
    }
  }
  const docsStatus: Record<string, DocStatus> = {};
  const docsUpdated: Record<string, string> = {};
  if (parsed?.docsStatus && typeof parsed.docsStatus === 'object' && !Array.isArray(parsed.docsStatus)) {
    for (const [id, value] of Object.entries(parsed.docsStatus)) {
      if (SEED_DOC_IDS.has(id) && isDocStatus(value)) docsStatus[id] = value;
    }
  }
  if (parsed?.docsUpdated && typeof parsed.docsUpdated === 'object' && !Array.isArray(parsed.docsUpdated)) {
    for (const [id, value] of Object.entries(parsed.docsUpdated)) {
      if (docsStatus[id] && typeof value === 'string') docsUpdated[id] = value;
    }
  }
  return { created, status, docsStatus, docsUpdated };
}

export function isStaleHarborFundraisingSeed(blob: string): boolean {
  return FUNDRAISING_STALE_SNIPPETS.some((snippet) => blob.includes(snippet));
}

export function readFundraisingOverlay(): FundraisingOverlay {
  if (typeof window === 'undefined') return emptyFundraisingOverlay();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyFundraisingOverlay();
    return coerceFundraisingOverlay(JSON.parse(raw) as Partial<FundraisingOverlay>);
  } catch {
    return emptyFundraisingOverlay();
  }
}

export function writeFundraisingOverlay(overlay: FundraisingOverlay) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(coerceFundraisingOverlay(overlay)));
}

export function resolveFundraisingLeads(overlay: Partial<FundraisingOverlay> = emptyFundraisingOverlay()): InvestorLead[] {
  const resolved = coerceFundraisingOverlay(overlay);
  const fromSeed = FUNDRAISING_SEED_LEADS.map((l) => ({
    ...l,
    status: resolved.status[l.id] ?? l.status,
  }));
  const created = resolved.created.map((l) => ({
    ...l,
    status: resolved.status[l.id] ?? l.status,
  }));
  return [...created, ...fromSeed];
}

export function listFundraisingLeads(): InvestorLead[] {
  return resolveFundraisingLeads(readFundraisingOverlay());
}

export function resolveFundraisingDocs(overlay: Partial<FundraisingOverlay> = emptyFundraisingOverlay()): DataRoomDoc[] {
  const resolved = coerceFundraisingOverlay(overlay);
  return FUNDRAISING_SEED_DOCS.map((d) => ({
    ...d,
    status: resolved.docsStatus[d.id] ?? d.status,
    lastUpdated: resolved.docsUpdated[d.id] ?? d.lastUpdated,
  }));
}

export function listFundraisingDocs(): DataRoomDoc[] {
  return resolveFundraisingDocs(readFundraisingOverlay());
}

export function fundraisingPipelineStats(leads: InvestorLead[]) {
  const committed = leads.filter((l) => l.status === 'committed').length;
  const active = leads.filter((l) => ACTIVE_STATUSES.includes(l.status)).length;
  return {
    total: leads.length,
    active,
    committed,
    conversion: leads.length ? Math.round((committed / leads.length) * 100) : 0,
  };
}

/** Round.investors is the committed count — never a hardcoded 4 that disagrees with the pipeline. */
export function fundraisingRoundView(leads: InvestorLead[] = FUNDRAISING_SEED_LEADS): FundRound & { investors: number } {
  const stats = fundraisingPipelineStats(leads);
  return { ...FUNDRAISING_SEED_ROUND, investors: stats.committed };
}

export function addFundraisingLead(input: Omit<InvestorLead, 'id' | 'isVerified'> & { isVerified?: boolean }): InvestorLead {
  const lead: InvestorLead = {
    ...input,
    id: `l-${Date.now()}`,
    isVerified: input.isVerified ?? false,
  };
  const overlay = readFundraisingOverlay();
  overlay.created = [lead, ...overlay.created];
  writeFundraisingOverlay(overlay);
  return lead;
}

export function moveFundraisingLead(id: string, status: InvestorStatus) {
  const overlay = readFundraisingOverlay();
  overlay.status[id] = status;
  writeFundraisingOverlay(overlay);
}

export function markFundraisingDocStatus(id: string, status: DocStatus) {
  const overlay = readFundraisingOverlay();
  overlay.docsStatus[id] = status;
  overlay.docsUpdated[id] = new Date().toISOString();
  writeFundraisingOverlay(overlay);
}

export function fmtMoney(n: number, currency = '$') {
  if (n >= 1_000_000) return `${currency}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${currency}${(n / 1_000).toFixed(0)}K`;
  return `${currency}${n}`;
}

export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}
