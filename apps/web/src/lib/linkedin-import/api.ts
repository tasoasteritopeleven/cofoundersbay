import type { LinkedInRecord } from '@cofounderbay/shared';
import { apiRequest } from '@/lib/api';

/** Whether the server can fetch a profile through LinkedIn's DMA portability API (EU members, approved app). */
export async function getProfileImportStatus(): Promise<{ available: boolean }> {
  const res = await apiRequest<{ available?: unknown }>('/api/profile-import/linkedin/status');
  return { available: res?.available === true };
}

export async function startProfileImport(): Promise<{ url: string }> {
  return apiRequest('/api/profile-import/linkedin/start');
}

export type ImportRecords = { profile?: LinkedInRecord[]; positions?: LinkedInRecord[]; education?: LinkedInRecord[]; skills?: LinkedInRecord[] };

/** The records LinkedIn sent, once: the server deletes them as it answers. */
export async function takeProfileImportDraft(): Promise<{ records: ImportRecords | null }> {
  const res = await apiRequest<{ records?: ImportRecords | null }>('/api/profile-import/draft');
  return { records: res?.records && typeof res.records === 'object' ? res.records : null };
}
