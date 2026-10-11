import { describe, expect, it, vi } from 'vitest';
import { placeVariants, readNaturalSearch } from '@cofounderbay/shared';
import { SearchService } from './search.service';

/** A Prisma stand-in that records the `where` of the first findMany. */
function recordingPrisma() {
  const seen: { where?: unknown } = {};
  const prisma = {
    profile: {
      findMany: vi.fn(async (args: { where: unknown }) => {
        seen.where ??= args.where;
        return [];
      }),
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
    },
    subscription: { findMany: vi.fn(async () => []) },
  };
  return { prisma, seen };
}

describe('plain-language search', () => {
  it('reads a Greek request into the directory filters the sheet uses', () => {
    const r = readNaturalSearch('συνιδρυτής fintech Θεσσαλονίκη part-time');
    expect(r.roles).toEqual(['founder']);
    expect(r.industries).toEqual(['Fintech']);
    expect(r.location).toBe('Thessaloniki');
    expect(r.availability).toEqual(['part-time']);
    expect(r.rest).toBe('');
    expect(r.understood.map((u) => u.kind)).toEqual(['role', 'industry', 'location', 'availability']);
  });

  it('keeps names, skills and unknown words as free text, accents intact', () => {
    expect(readNaturalSearch('Elena').rest).toBe('Elena');
    expect(readNaturalSearch('Elena').understood).toEqual([]);
    const r = readNaturalSearch('μέντορας για μάρκετινγκ στη Θεσσαλονίκη');
    expect(r.roles).toEqual(['mentor']);
    expect(r.rest).toBe('μάρκετινγκ');
    expect(readNaturalSearch('technical cofounder in Athens, full time').rest).toBe('technical');
  });

  it('follows Greek declension and takes the longer phrase first', () => {
    expect(readNaturalSearch('ιδρυτές της Αθήνας').location).toBe('Athens');
    expect(readNaturalSearch('angel investor pre-seed').fundingStage).toEqual(['pre-seed']);
    expect(readNaturalSearch('angel investor pre-seed').roles).toEqual(['investor']);
    expect(readNaturalSearch('series a').fundingStage).toEqual(['series-a']);
  });

  it('knows every spelling of a place, and leaves an unknown place as typed', () => {
    expect(placeVariants('thessaloniki')).toEqual(expect.arrayContaining(['Thessaloniki', 'Θεσσαλονίκη']));
    expect(placeVariants('Θεσσαλονίκη')).toEqual(expect.arrayContaining(['Thessaloniki']));
    expect(placeVariants('Kalamata')).toEqual(['Kalamata']);
  });

  it('matches every word of a query in any order, not the phrase as one string', async () => {
    const { prisma, seen } = recordingPrisma();
    const service = new SearchService(prisma as never, { isEnabled: () => false } as never);
    await service.searchProfiles({ q: 'technical cofounder' });
    const and = (seen.where as { AND: Array<{ OR: Array<Record<string, { contains: string }>> }> }).AND;
    const words = and.map((clause) => clause.OR[0].displayName.contains);
    expect(words).toEqual(['technical', 'cofounder']);
  });

  it('matches a place in either language', async () => {
    const { prisma, seen } = recordingPrisma();
    const service = new SearchService(prisma as never, { isEnabled: () => false } as never);
    await service.searchProfiles({ location: 'Thessaloniki' });
    const and = (seen.where as { AND: Array<{ OR: Array<{ location: { contains: string } }> }> }).AND;
    expect(and[0].OR.map((o) => o.location.contains)).toEqual(expect.arrayContaining(['Thessaloniki', 'Θεσσαλονίκη']));
  });
});
