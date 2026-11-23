import type { SearchFiltersValues } from '@/components/discover/SearchFilters';

export const defaultDiscoverFilters: SearchFiltersValues = {
  q: '', role: [], skills: [], industries: [], stage: [], location: '',
  remote: null, availability: [], fundingStage: [], languages: [], sortBy: 'relevance',
};

export const DISCOVER_ROLE_CHIPS = ['all', 'founder', 'cofounder', 'mentor', 'investor', 'service_provider'] as const;
export type DiscoverRole = (typeof DISCOVER_ROLE_CHIPS)[number];
export type DiscoverTab = 'search' | 'matches';

const clean = (value: string | null, limit = 120) => value?.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit) ?? '';
const lists = [
  ['roles', 'role'], ['skills', 'skills'], ['industries', 'industries'],
  ['stage', 'stage'], ['availability', 'availability'], ['fundingStage', 'fundingStage'], ['languages', 'languages'],
] as const;

export function readDiscoverUrl(params: URLSearchParams) {
  const filters = { ...defaultDiscoverFilters };
  filters.q = clean(params.get('q'), 240);
  filters.location = params.has('location') ? clean(params.get('location')) : clean(params.get('locations')?.split(',')[0] ?? null);
  for (const [param, key] of lists) {
    filters[key] = [...new Set(params.getAll(param).flatMap((value) => value.split(',')).map((value) => clean(value)).filter(Boolean))].slice(0, 20);
  }
  const sort = params.get('sort');
  if (sort === 'recent' || sort === 'active') filters.sortBy = sort;
  const remote = params.get('remote');
  if (remote === '1' || remote === '0') filters.remote = remote === '1';
  const roleChip = DISCOVER_ROLE_CHIPS.find((candidate) => candidate === params.get('role')) ?? 'all';
  const tab: DiscoverTab = params.get('tab') === 'matches' ? 'matches' : 'search';
  return { filters, roleChip, tab };
}

export function writeDiscoverUrl(source: URLSearchParams, filters: SearchFiltersValues, role: DiscoverRole, tab: DiscoverTab) {
  const params = new URLSearchParams(source);
  const set = (key: string, value: string) => { if (value) params.set(key, value); else params.delete(key); };
  set('q', clean(filters.q, 240));
  set('location', clean(filters.location));
  params.delete('locations');
  for (const [param, key] of lists) set(param, filters[key].map((value) => clean(value)).filter(Boolean).slice(0, 20).join(','));
  set('sort', filters.sortBy === 'relevance' ? '' : filters.sortBy);
  set('remote', filters.remote === null ? '' : filters.remote ? '1' : '0');
  set('role', role === 'all' ? '' : role);
  set('tab', tab === 'search' ? '' : tab);
  return params;
}
