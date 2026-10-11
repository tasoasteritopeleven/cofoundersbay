import { describe, expect, it } from 'vitest';
import {
  DEMO_PROJECTS_SEED,
  DEMO_PROJECTS_ME_ID,
  emptyProjectsOverlay,
  isStaleHarborProjectSeed,
  overlayApplyRole,
  overlayRequestJoin,
  resolveDemoProjects,
} from './projects-demo';

describe('preview projects', () => {
  it('refuses leftover generic titles on Harbor seed ids', () => {
    expect(isStaleHarborProjectSeed({
      id: '1',
      name: 'EcoTrack',
      description: 'AI-powered carbon footprint tracking for businesses',
    })).toBe(true);
    expect(isStaleHarborProjectSeed({
      id: '1',
      name: 'Harbor',
      description: DEMO_PROJECTS_SEED[0].description,
    })).toBe(false);
  });

  it('keeps user-created extras next to Harbor without aliasing seed ids', () => {
    const extra = {
      ...DEMO_PROJECTS_SEED[2],
      id: 'p-test-extra',
      name: 'Share deck with Athens Tech Angels',
      founder: { id: DEMO_PROJECTS_ME_ID, name: 'Alex Demo', role: 'founder' },
      members: [{ id: DEMO_PROJECTS_ME_ID, name: 'Alex Demo', role: 'Founder' }],
    };
    const listed = resolveDemoProjects({
      created: [extra],
      starred: {},
      deleted: [],
    });
    expect(listed.some((p) => p.id === 'p-test-extra')).toBe(true);
    expect(listed.some((p) => p.id === '1' && p.name === 'Harbor')).toBe(true);
    expect(listed.filter((p) => p.id === extra.id)).toHaveLength(1);
  });

  it('keeps join and apply as this-browser overlay until a projects API exists', () => {
    const empty = emptyProjectsOverlay();
    const joinedHarbor = overlayRequestJoin(empty, '1');
    expect(joinedHarbor.joinRequested).toEqual(['1']);
    expect(overlayRequestJoin(empty, '3').joinRequested).toEqual([]);
    expect(overlayRequestJoin(empty, '2').joinRequested).toEqual([]);
    const applied = overlayApplyRole(empty, '1', 'Complementary cofounder — technical + commercial pair');
    expect(applied.appliedRoles['1']).toEqual(['Complementary cofounder — technical + commercial pair']);
    expect(overlayApplyRole(empty, '3', 'Complementary cofounder — technical + commercial pair').appliedRoles['3']).toBeUndefined();
  });

  it('drops extras on delete without restoring Harbor', () => {
    const extra = {
      ...DEMO_PROJECTS_SEED[2],
      id: 'p-to-delete',
      name: 'Share deck with Athens Tech Angels',
    };
    const after = resolveDemoProjects({
      created: [extra],
      starred: {},
      deleted: ['p-to-delete'],
    });
    expect(after.some((p) => p.id === 'p-to-delete')).toBe(false);
    expect(after.some((p) => p.id === '1' && p.name === 'Harbor')).toBe(true);
    expect(emptyProjectsOverlay().created).toEqual([]);
  });
});
