import type { CapTableHolder } from '@cofounderbay/shared';
import { apiRequest, getApiBase } from '@/lib/api';
import { restoreDateOnly } from '@/lib/calendar-days';
import type { DataRoomDoc, FundRound, InvestorLead, InvestorStatus } from '@/lib/fundraising-demo';

/**
 * A real account's round, investors and data room (`/api/fundraising`, docs
 * §111). The API speaks in its own words (`due_diligence`, `EUR`, amounts as
 * numbers); the page's cards were built for the showcase's words, so the
 * adapters here are the one place the two meet and the cards stay as they are.
 */

export type ApiLeadStatus = 'prospect' | 'contacted' | 'meeting' | 'due_diligence' | 'committed' | 'passed' | 'inactive';

export type ApiRound = {
  id: string;
  name: string;
  roundType: string;
  status: 'planning' | 'active' | 'closing' | 'closed' | 'cancelled';
  currency: string;
  targetAmount: number | null;
  raisedAmount: number;
  investors: number;
  preMoneyValuation: number | null;
  leadInvestorName: string | null;
  closingDate: string | null;
  description: string | null;
  capTable?: CapTableHolder[];
};

export type LinkedAccount = { id: string; displayName: string; avatarUrl: string | null; headline: string | null };

export type ApiLead = {
  id: string;
  investorName: string;
  investorFirm: string | null;
  investorEmail?: string | null;
  investorType: string | null;
  stageFocus: string | null;
  checkSizeText: string | null;
  status: ApiLeadStatus;
  committedAmount: number | null;
  currency: string;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  nextStep: string | null;
  notes: string | null;
  isVerifiedOnPlatform: boolean;
  /** The investor's own account: what lets them open what is shared. */
  linkedAccount: LinkedAccount | null;
};

export type ApiDocument = {
  id: string;
  name: string;
  category: string;
  status: 'draft' | 'ready' | 'shared' | 'archived';
  isRequired: boolean;
  hasFile: boolean;
  fileName: string | null;
  fileMimeType: string | null;
  fileSizeBytes: number | null;
  viewCount: number;
  sharedWithLeads: boolean;
  /** Who opened it, latest first. */
  openedBy: string[];
  lastOpenedAt: string | null;
  updatedAt: string;
};

export type SharedRoom = {
  roundId: string;
  roundName: string;
  roundType: string;
  owner: LinkedAccount | null;
  documents: Array<{
    id: string;
    name: string;
    category: string;
    fileName: string | null;
    fileMimeType: string | null;
    fileSizeBytes: number | null;
    updatedAt: string;
  }>;
};

export type FundraisingState = { round: ApiRound | null; leads: ApiLead[]; documents: ApiDocument[] };

export type RoundInput = {
  name: string;
  roundType: string;
  currency: string;
  targetAmount: number | null;
  closingDate: string | null;
  leadInvestorName: string | null;
  status?: ApiRound['status'];
  capTable?: CapTableHolder[];
};

export type LeadInput = {
  investorName: string;
  investorFirm?: string | null;
  investorEmail?: string | null;
  investorType?: string | null;
  stageFocus?: string | null;
  checkSizeText?: string | null;
  status?: ApiLeadStatus;
  committedAmount?: number | null;
  notes?: string | null;
  nextFollowUpAt?: string | null;
  nextStep?: string | null;
};

export const ROUND_TYPES: Array<{ value: string; en: string; el: string }> = [
  { value: 'pre_seed', en: 'Pre-seed', el: 'Pre-seed' },
  { value: 'seed', en: 'Seed', el: 'Seed' },
  { value: 'series_a', en: 'Series A', el: 'Series A' },
  { value: 'series_b', en: 'Series B', el: 'Series B' },
  { value: 'bridge', en: 'Bridge', el: 'Γέφυρα' },
  { value: 'safe', en: 'SAFE', el: 'SAFE' },
  { value: 'convertible_note', en: 'Convertible note', el: 'Μετατρέψιμο δάνειο' },
  { value: 'grant', en: 'Grant', el: 'Επιχορήγηση' },
  { value: 'revenue_based', en: 'Revenue-based', el: 'Βάσει εσόδων' },
  { value: 'other', en: 'Other', el: 'Άλλο' },
];

export const ROUND_CURRENCIES = ['EUR', 'USD', 'GBP'] as const;
const SYMBOL: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' };

const TO_API_STATUS: Record<InvestorStatus, ApiLeadStatus> = {
  prospect: 'prospect', contacted: 'contacted', meeting: 'meeting', dd: 'due_diligence', committed: 'committed', passed: 'passed',
};
const FROM_API_STATUS: Record<ApiLeadStatus, InvestorStatus> = {
  prospect: 'prospect', contacted: 'contacted', meeting: 'meeting', due_diligence: 'dd', committed: 'committed', passed: 'passed', inactive: 'passed',
};

/** The page's category names ("Financials") against the API's (`financials`). */
export const apiCategory = (category: string) => category.toLowerCase();
const pageCategory = (category: string) => category.charAt(0).toUpperCase() + category.slice(1);

export function apiLeadStatus(status: InvestorStatus): ApiLeadStatus {
  return TO_API_STATUS[status];
}

export function leadFromApi(lead: ApiLead): InvestorLead {
  const symbol = SYMBOL[lead.currency] ?? lead.currency;
  return {
    id: lead.id,
    name: lead.investorName,
    firm: lead.investorFirm ?? undefined,
    email: lead.investorEmail ?? undefined,
    type: lead.investorType ?? 'Angel',
    stage: lead.stageFocus ?? '',
    // A committed amount is the fact; the range was the first guess.
    checkSize: lead.committedAmount ? `${symbol}${lead.committedAmount.toLocaleString('en-GB')}` : (lead.checkSizeText ?? ''),
    status: FROM_API_STATUS[lead.status],
    lastContact: lead.lastContactAt ?? undefined,
    nextFollowUp: lead.nextFollowUpAt ? restoreDateOnly(lead.nextFollowUpAt) : undefined,
    nextStep: lead.nextStep ?? undefined,
    notes: lead.notes ?? undefined,
    isVerified: lead.isVerifiedOnPlatform,
  };
}

export function docFromApi(doc: ApiDocument): DataRoomDoc {
  return {
    id: doc.id,
    name: doc.name,
    category: pageCategory(doc.category),
    status: doc.status === 'archived' ? 'draft' : doc.status,
    isRequired: doc.isRequired,
    lastUpdated: doc.updatedAt,
    hasFile: doc.hasFile,
    fileName: doc.fileName ?? undefined,
    openedBy: doc.openedBy,
  };
}

export function roundFromApi(round: ApiRound): FundRound & { investors: number; apiId: string; roundType: string; currencyCode: string } {
  return {
    id: round.id,
    apiId: round.id,
    name: round.name,
    // The name the API gives a round nobody has named; a member's own stays as written.
    nameEl: round.name === 'My round' ? 'Ο γύρος μου' : undefined,
    type: ROUND_TYPES.find((t) => t.value === round.roundType)?.en ?? round.roundType,
    roundType: round.roundType,
    currency: SYMBOL[round.currency] ?? round.currency,
    currencyCode: round.currency,
    target: round.targetAmount ?? 0,
    raised: round.raisedAmount,
    // A cancelled round reads as closed: the page has no fifth state.
    status: round.status === 'cancelled' ? 'closed' : round.status,
    closingDate: round.closingDate ?? undefined,
    valuation: round.preMoneyValuation ?? undefined,
    leadInvestor: round.leadInvestorName ?? undefined,
    investors: round.investors,
  };
}

export type RoomLink = {
  id: string;
  label: string | null;
  expiresAt: string;
  revokedAt: string | null;
  openCount: number;
  lastOpenedAt: string | null;
  createdAt: string;
};

export type PublicRoom = {
  roundName: string;
  founderName: string;
  expiresAt: string;
  documents: Array<{ id: string; name: string; category: string; fileName: string | null; fileSizeBytes: number | null }>;
};

export function listRoomLinks(): Promise<RoomLink[]> {
  return apiRequest('/api/fundraising/links');
}

/** The token comes back this once: the API keeps only its hash. */
export function createRoomLink(body: { label: string | null; days: number }): Promise<{ token: string; link: RoomLink }> {
  return apiRequest('/api/fundraising/links', { method: 'POST', body: JSON.stringify(body) });
}

export function revokeRoomLink(id: string): Promise<RoomLink[]> {
  return apiRequest(`/api/fundraising/links/${id}`, { method: 'DELETE' });
}

export function getPublicRoom(token: string): Promise<PublicRoom> {
  return apiRequest(`/api/public/data-room/${encodeURIComponent(token)}`);
}

export function publicRoomFileHref(token: string, documentId: string): string {
  return `${getApiBase()}/api/public/data-room/${encodeURIComponent(token)}/documents/${encodeURIComponent(documentId)}/file`;
}

export function getFundraising(): Promise<FundraisingState> {
  return apiRequest('/api/fundraising');
}

export function createFundraisingRound(body: RoundInput): Promise<FundraisingState> {
  return apiRequest('/api/fundraising/rounds', { method: 'POST', body: JSON.stringify(body) });
}

export function updateFundraisingRound(id: string, body: Partial<RoundInput>): Promise<FundraisingState> {
  return apiRequest(`/api/fundraising/rounds/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function createFundraisingLead(body: LeadInput): Promise<FundraisingState> {
  return apiRequest('/api/fundraising/leads', { method: 'POST', body: JSON.stringify(body) });
}

export function updateFundraisingLead(id: string, body: Partial<LeadInput>): Promise<FundraisingState> {
  return apiRequest(`/api/fundraising/leads/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

/** Linking is what gives an investor access; null ends it. */
export function linkFundraisingLead(id: string, platformUserId: string | null): Promise<FundraisingState> {
  return apiRequest(`/api/fundraising/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ platformUserId }) });
}

export function searchFundraisingMembers(q: string): Promise<{ members: Array<LinkedAccount & { isInvestor: boolean }> }> {
  return apiRequest(`/api/fundraising/investors/search?q=${encodeURIComponent(q)}`);
}

export function shareFundraisingDocuments(documentIds: string[], shared: boolean): Promise<FundraisingState> {
  return apiRequest('/api/fundraising/documents/sharing', { method: 'POST', body: JSON.stringify({ documentIds, shared }) });
}

export function listSharedRooms(): Promise<{ rooms: SharedRoom[] }> {
  return apiRequest('/api/fundraising/shared');
}

export function uploadFundraisingDocument(file: File, fields: { category: string; isRequired?: boolean }): Promise<FundraisingState> {
  const form = new FormData();
  form.append('file', file);
  form.append('category', fields.category);
  if (fields.isRequired) form.append('isRequired', 'true');
  return apiRequest('/api/fundraising/documents', { method: 'POST', body: form });
}

export function updateFundraisingDocument(id: string, body: { status?: ApiDocument['status'] }): Promise<FundraisingState> {
  return apiRequest(`/api/fundraising/documents/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function removeFundraisingDocument(id: string): Promise<FundraisingState> {
  return apiRequest(`/api/fundraising/documents/${id}`, { method: 'DELETE' });
}

/** The file through the API, which checks who is asking; there is no public address to link to. */
export async function downloadFundraisingDocument(id: string, fileName: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/fundraising/documents/${id}/file`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
