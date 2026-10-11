import { describe, expect, it } from 'vitest';
import { resolvePreviewApi } from './preview-api';

type Milestone = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  progress: number;
  collaborator?: { id: string; displayName: string } | null;
  collaboratorId?: string | null;
};

type MilestoneList = { milestones?: Milestone[] };

describe('preview milestones', () => {
  it('keeps Harbor goals aligned with Idea Core and the $750K seed', () => {
    const listed = resolvePreviewApi('/api/milestones') as MilestoneList;
    const seed = listed.milestones?.find((m) => m.id === 'ms-4');
    expect(seed?.title).toBe('Close $750K seed');
    expect(seed?.description ?? '').toContain('$750K');
    expect(seed?.description ?? '').toContain('Athens Tech Angels');
    expect(seed?.collaborator?.displayName).toBe('Elena Papadopoulos');
    expect(listed.milestones?.some((m) => m.title === 'Launch beta to first 20 users')).toBe(false);
    expect(listed.milestones?.some((m) => m.title === 'Complementary cofounder — technical + commercial pair')).toBe(true);
  });

  it('replaces leftover generic titles with Harbor copy on the next list GET', () => {
    resolvePreviewApi('/api/milestones/ms-1', {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'Launch beta to first 20 users',
        description: 'Invite waitlist, instrument onboarding, collect qualitative feedback.',
      }),
    });
    const listed = resolvePreviewApi('/api/milestones') as MilestoneList;
    const row = listed.milestones?.find((m) => m.id === 'ms-1');
    expect(row?.title).toBe('Complementary cofounder — technical + commercial pair');
    expect(row?.description ?? '').not.toContain('Invite waitlist');
  });

  it('creates, completes, and deletes without aliasing Harbor seed rows', () => {
    const created = resolvePreviewApi('/api/milestones', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Share deck with Athens Tech Angels',
        collaboratorId: 'user-elena',
      }),
    }) as Milestone;
    expect(created.title).toBe('Share deck with Athens Tech Angels');
    expect(created.id).toMatch(/^preview-ms-/);
    expect(created.collaborator?.displayName).toBe('Elena Papadopoulos');

    const listed = resolvePreviewApi('/api/milestones') as MilestoneList;
    expect(listed.milestones?.some((m) => m.id === created.id)).toBe(true);
    expect(listed.milestones?.some((m) => m.id === 'ms-4' && m.title === 'Close $750K seed')).toBe(true);

    const completed = resolvePreviewApi(`/api/milestones/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    }) as Milestone;
    expect(completed.status).toBe('completed');
    expect(completed.progress).toBe(100);

    resolvePreviewApi(`/api/milestones/${created.id}`, { method: 'DELETE' });
    const after = resolvePreviewApi('/api/milestones') as MilestoneList;
    expect(after.milestones?.some((m) => m.id === created.id)).toBe(false);
    expect(after.milestones?.some((m) => m.id === 'ms-4')).toBe(true);
  });
});
