import { describe, expect, it } from 'vitest';
import {
  deriveApplicationStatus,
  mergeSavedApplications,
  requiredCompletion,
} from '@/components/builder/ApplicationGenerator';
import {
  harborApplicationDrafts,
  isStaleHarborApplicationBlob,
  mergeEmptyApplicationAnswers,
  PREVIEW_APPLICATION_SEED,
} from '@/components/builder/application-model';
import {
  applicationQuestionCopy,
  applicationTipCopy,
} from '@/lib/i18n/strings-application-questions';

describe('program applications catalogue lockstep', () => {
  const seed = mergeSavedApplications(undefined);

  it('keeps the four program templates and never drops questions on merge', () => {
    expect(seed.map((app) => app.id)).toEqual(['yc', 'techstars', 'university', 'grant']);
    expect(seed.every((app) => app.questions.length > 0)).toBe(true);

    const ycQuestions = seed.find((app) => app.id === 'yc')!.questions.length;
    const merged = mergeSavedApplications({
      applications: [
        { id: 'yc', status: 'in-progress', questions: [{ id: 'yc1', answer: 'AI matching for founders.' }] },
        { id: 'unknown-program', questions: [{ id: 'x', answer: 'drop me' }] },
      ],
    });

    expect(merged).toHaveLength(4);
    expect(merged.map((app) => app.id)).toEqual(['yc', 'techstars', 'university', 'grant']);
    const yc = merged.find((app) => app.id === 'yc')!;
    expect(yc.questions).toHaveLength(ycQuestions);
    expect(yc.questions.find((q) => q.id === 'yc1')?.answer).toBe('AI matching for founders.');
    expect(yc.questions.find((q) => q.id === 'yc2')?.answer).toBe('');
  });

  it('unwraps the workspace artefact whether it is nested once or twice', () => {
    const inner = mergeSavedApplications({
      applications: { applications: [{ id: 'grant', questions: [{ id: 'gr1', answer: 'CoFounderBay' }] }] },
    });
    expect(inner.find((app) => app.id === 'grant')?.questions.find((q) => q.id === 'gr1')?.answer).toBe('CoFounderBay');
  });

  it('derives draft / in-progress / completed from required answers and keeps submitted', () => {
    const [yc] = seed;
    expect(requiredCompletion(yc)).toBe(0);
    expect(deriveApplicationStatus(yc)).toBe('draft');

    const partial = {
      ...yc,
      questions: yc.questions.map((q, i) => (i === 0 ? { ...q, answer: 'Filled' } : q)),
    };
    expect(requiredCompletion(partial)).toBeGreaterThan(0);
    expect(requiredCompletion(partial)).toBeLessThan(100);
    expect(deriveApplicationStatus(partial)).toBe('in-progress');

    const complete = {
      ...yc,
      questions: yc.questions.map((q) => (q.required ? { ...q, answer: 'Done' } : q)),
    };
    expect(requiredCompletion(complete)).toBe(100);
    expect(deriveApplicationStatus(complete)).toBe('completed');

    expect(deriveApplicationStatus({ ...complete, status: 'submitted' })).toBe('submitted');
  });

  it('has a distinct Greek prompt for every template question', () => {
    for (const app of seed) {
      for (const question of app.questions) {
        const prompt = applicationQuestionCopy(question.id, question.question);
        expect(prompt.el, question.id).toBeTruthy();
        expect(prompt.el, question.id).not.toBe(prompt.en);
        if (question.tips) {
          const tip = applicationTipCopy(question.id, question.tips);
          expect(tip?.el, `${question.id} tip`).toBeTruthy();
          expect(tip?.el, `${question.id} tip`).not.toBe(tip?.en);
        }
      }
    }
  });

  it('keeps Harbor YC and university drafts without invented traction', () => {
    const apps = mergeSavedApplications(PREVIEW_APPLICATION_SEED);
    const yc = apps.find((app) => app.id === 'yc')!;
    const yc1 = yc.questions.find((q) => q.id === 'yc1')!.answer;
    expect(yc1.length).toBeLessThanOrEqual(50);
    expect(yc1).toBe('Harbor OS for early-stage founders.');
    expect(deriveApplicationStatus(yc)).toBe('in-progress');
    expect(requiredCompletion(apps.find((app) => app.id === 'techstars')!)).toBe(0);
    expect(requiredCompletion(apps.find((app) => app.id === 'grant')!)).toBe(0);
    expect(deriveApplicationStatus(apps.find((app) => app.id === 'university')!)).toBe('in-progress');
    expect(isStaleHarborApplicationBlob(JSON.stringify(apps))).toBe(false);
    expect(isStaleHarborApplicationBlob('Sequoia Capital and $3M ARR in San Francisco')).toBe(true);
  });

  it('fills empty answers only and never overwrites a filled field', () => {
    const yc = mergeSavedApplications(PREVIEW_APPLICATION_SEED).find((app) => app.id === 'yc')!;
    const filled = yc.questions.find((q) => q.id === 'yc1')!.answer;
    const merged = mergeEmptyApplicationAnswers(yc, {
      yc1: 'Overwrite me with Sequoia and $3M ARR',
      yc4: harborApplicationDrafts('yc').yc4,
    });
    expect(merged.questions.find((q) => q.id === 'yc1')?.answer).toBe(filled);
    expect(merged.questions.find((q) => q.id === 'yc4')?.answer).toContain('Elena Papadopoulos');
    expect(isStaleHarborApplicationBlob(JSON.stringify(merged.questions.map((q) => q.answer)))).toBe(false);
  });
});
