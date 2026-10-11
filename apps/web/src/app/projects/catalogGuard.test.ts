import { describe, expect, it } from 'vitest';
import {
  DEMO_PROJECTS_ME_ID,
  DEMO_PROJECTS_SEED,
  DEMO_PROJECT_ELENA_ID,
  demoProjectStats,
  getDemoProject,
  isJoinedProject,
  isOwnedProject,
  isStaleHarborProjectSeed,
  resolveDemoProjects,
} from '@/lib/projects-demo';

describe('projects catalogue lockstep', () => {
  const projects = resolveDemoProjects();
  const stats = demoProjectStats(projects);

  it('keeps discover counts aligned with the summary strip', () => {
    expect(projects).toHaveLength(3);
    expect(stats.total).toBe(3);
    expect(stats.active).toBe(1);
    expect(stats.openRoles).toBe(1);
    expect(stats.industries).toBe(3);
  });

  it('keeps Harbor aligned with Idea Core and the $750K seed', () => {
    expect(getDemoProject('1')?.name).toBe('Harbor');
    expect(getDemoProject('1')?.founder.id).toBe(DEMO_PROJECT_ELENA_ID);
    expect(getDemoProject('1')?.description ?? '').toContain('$750K');
    expect(getDemoProject('1')?.description ?? '').toContain('Athens Tech Angels');
    expect(getDemoProject('2')?.name).toBe('Harbor GTM board');
    expect(getDemoProject('3')?.name).toBe('First founder-network path in Athens');
    expect(getDemoProject('missing')).toBeUndefined();
    expect(projects.some((p) => p.name === 'EcoTrack')).toBe(false);
    expect(projects.some((p) => (p.description ?? '').includes('Fortune 500'))).toBe(false);
    expect(getDemoProject('1')?.descriptionEl ?? '').toContain('συμπληρωματικός');
  });

  it('fills My projects / Joined / Starred so those tabs are not always empty', () => {
    const mine = projects.filter((p) => isOwnedProject(p));
    const joined = projects.filter((p) => isJoinedProject(p));
    const starred = projects.filter((p) => p.isStarred);
    expect(mine.map((p) => p.name)).toEqual(['First founder-network path in Athens']);
    expect(joined.map((p) => p.name)).toEqual(['Harbor GTM board']);
    expect(starred.map((p) => p.name)).toEqual(['Harbor']);
    expect(mine[0]?.founder.id).toBe(DEMO_PROJECTS_ME_ID);
    expect(DEMO_PROJECTS_SEED).toHaveLength(3);
  });

  it('rewrites leftover EcoTrack copy on seed ids without restoring deleted rows', () => {
    expect(isStaleHarborProjectSeed({
      id: '1',
      name: 'EcoTrack',
      description: 'Closed our first enterprise deal with a Fortune 500 company!',
    })).toBe(true);
    const listed = resolveDemoProjects({
      created: [{
        ...DEMO_PROJECTS_SEED[0],
        name: 'EcoTrack',
        description: 'Invite waitlist and a Fortune 500 logo.',
      }],
      starred: {},
      deleted: ['1'],
    });
    expect(listed.some((p) => p.id === '1')).toBe(false);
    expect(listed.some((p) => p.name === 'EcoTrack')).toBe(false);
  });
});
