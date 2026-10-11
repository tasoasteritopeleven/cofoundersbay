import { describe, expect, it } from 'vitest';
import {
  harborApplicationDrafts,
  isStaleHarborApplicationBlob,
  mergeEmptyApplicationAnswers,
  mergeSavedApplications,
  pickGeneratedAnswers,
  PREVIEW_APPLICATION_SEED,
  requiredCompletion,
} from '@/components/builder/application-model';

describe('preview applications', () => {
  it('seeds YC and university only, keeping Techstars and grant empty', () => {
    const apps = mergeSavedApplications(PREVIEW_APPLICATION_SEED);
    expect(apps.map((app) => app.id)).toEqual(['yc', 'techstars', 'university', 'grant']);
    expect(requiredCompletion(apps.find((app) => app.id === 'yc')!)).toBeGreaterThan(0);
    expect(requiredCompletion(apps.find((app) => app.id === 'techstars')!)).toBe(0);
    expect(requiredCompletion(apps.find((app) => app.id === 'university')!)).toBeGreaterThan(0);
    expect(requiredCompletion(apps.find((app) => app.id === 'grant')!)).toBe(0);
    expect(isStaleHarborApplicationBlob(JSON.stringify(apps))).toBe(false);
  });

  it('unwraps Harbor generate drafts without overwriting filled YC answers', () => {
    const yc = mergeSavedApplications(PREVIEW_APPLICATION_SEED).find((app) => app.id === 'yc')!;
    const incoming = pickGeneratedAnswers({ answers: harborApplicationDrafts('yc') });
    const merged = mergeEmptyApplicationAnswers(yc, incoming);
    expect(merged.questions.find((q) => q.id === 'yc1')?.answer).toBe(
      yc.questions.find((q) => q.id === 'yc1')?.answer,
    );
    expect(merged.questions.find((q) => q.id === 'yc4')?.answer).toContain('Elena Papadopoulos');
    expect(merged.questions.find((q) => q.id === 'yc8')?.answer).toContain('Athens Tech Angels');
    expect(isStaleHarborApplicationBlob(JSON.stringify(incoming))).toBe(false);
  });
});
