import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch } from 'meilisearch';

export const PROFILES_INDEX = 'profiles';

@Injectable()
export class MeilisearchService implements OnModuleInit {
  private client: MeiliSearch | null = null;
  private enabled: boolean = false;
  private readonly logger = new Logger(MeilisearchService.name);

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const host = this.config.get<string>('MEILISEARCH_HOST');
    const key = this.config.get<string>('MEILISEARCH_API_KEY');
    if (host && key) {
      this.client = new MeiliSearch({ host, apiKey: key });
      // Probe connectivity — disable if unreachable so fallback kicks in
      try {
        await this.client.health();
        this.enabled = true;
        this.logger.log('Meilisearch connected successfully');
      } catch {
        this.enabled = false;
        this.client = null;
        this.logger.warn('Meilisearch unreachable — using Prisma fallback for search');
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  getClient(): MeiliSearch | null {
    return this.client;
  }

  async ensureProfilesIndex(): Promise<void> {
    if (!this.client) return;
    const index = this.client.index(PROFILES_INDEX);
    await index.updateFilterableAttributes([
      'userId',
      'role',
      'location',
      'timezone',
      'languages',
      'skillNames',
      'skillSlugs',
      'stage',
      'industry',
      'commitment',
      'investmentStages',
    ]);
    await index.updateSortableAttributes(['createdAt', 'updatedAt']);
    await index.updateSearchableAttributes([
      'displayName',
      'headline',
      'bio',
      'location',
      'skillNames',
      'industry',
      'expertiseAreas',
      'investmentFocus',
    ]);
  }

  async indexProfile(doc: ProfileSearchDocument): Promise<void> {
    if (!this.client) return;
    const index = this.client.index(PROFILES_INDEX);
    await index.addDocuments([doc]);
  }

  async removeProfile(profileId: string): Promise<void> {
    if (!this.client) return;
    const index = this.client.index(PROFILES_INDEX);
    await index.deleteDocument(profileId);
  }

  async searchProfiles(params: {
    q?: string;
    roles?: string[];
    location?: string;
    skills?: string[];
    industries?: string[];
    stage?: string[];
    languages?: string[];
    commitment?: string[];
    investmentStages?: string[];
    sortBy?: 'relevance' | 'recent' | 'active';
    limit?: number;
    offset?: number;
  }): Promise<{ hits: ProfileSearchDocument[]; total: number }> {
    if (!this.client) return { hits: [], total: 0 };
    const index = this.client.index(PROFILES_INDEX);
    const filters: string[] = [];
    if (params.roles?.length) {
      filters.push(orGroup(params.roles.map((r) => `role = "${escapeFilterValue(r)}"`)));
    }
    if (params.skills?.length) {
      filters.push(orGroup(params.skills.map((s) => `skillNames = "${escapeFilterValue(s)}"`)));
    }
    if (params.languages?.length) {
      filters.push(orGroup(params.languages.map((l) => `languages = "${escapeFilterValue(l)}"`)));
    }
    if (params.industries?.length) {
      filters.push(orGroup(params.industries.map((i) => `industry = "${escapeFilterValue(i)}"`)));
    }
    if (params.stage?.length) {
      filters.push(orGroup(params.stage.map((st) => `stage = "${escapeFilterValue(st)}"`)));
    }
    if (params.commitment?.length) {
      filters.push(orGroup(params.commitment.map((c) => `commitment = "${escapeFilterValue(c)}"`)));
    }
    if (params.investmentStages?.length) {
      filters.push(orGroup(params.investmentStages.map((st) => `investmentStages = "${escapeFilterValue(st)}"`)));
    }

    const q = [params.q, params.location].filter(Boolean).join(' ').trim();

    const sort =
      params.sortBy === 'recent'
        ? ['createdAt:desc']
        : params.sortBy === 'active'
          ? ['updatedAt:desc']
          : undefined;

    try {
      const results = await index.search(q, {
        limit: Math.min(params.limit ?? 20, 50),
        offset: params.offset ?? 0,
        filter: filters.length ? filters.join(' AND ') : undefined,
        sort,
      });
      return {
        hits: (results.hits as ProfileSearchDocument[]),
        total: results.estimatedTotalHits ?? 0,
      };
    } catch (err) {
      // Disable Meilisearch so subsequent calls use Prisma fallback
      this.logger.warn('Meilisearch search failed, disabling for this session', err);
      this.enabled = false;
      this.client = null;
      throw err;
    }
  }
}

export interface ProfileSearchDocument {
  id: string;
  userId: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  timezone: string | null;
  languages: string[];
  avatarUrl: string | null;
  role: string;
  skillNames: string[];
  skillSlugs: string[];
  industry?: string;
  stage?: string;
  commitment?: string;
  investmentStages?: string[];
  expertiseAreas?: string[];
  investmentFocus?: string[];
  createdAt: number;
  updatedAt: number;
}

function escapeFilterValue(input: string): string {
  return input.replace(/"/g, '\\"');
}

function orGroup(parts: string[]): string {
  if (parts.length === 1) return parts[0]!;
  return `(${parts.join(' OR ')})`;
}
