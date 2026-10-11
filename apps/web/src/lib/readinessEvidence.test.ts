import { describe, expect, it } from 'vitest';
import { readinessEvidence } from './readiness-evidence';

/**
 * The sentence the readiness panel shows under each dimension.
 *
 * Two things are easy to get wrong here and neither shows up in a type:
 * Greek plural agreement, and what happens when a dimension has nothing to
 * report. Both are the difference between a sentence and a shrug.
 */
describe('readiness evidence', () => {
  it('agrees in number, in both languages', () => {
    const one = readinessEvidence('artifactCompleteness', { docCount: 1, avgCompletion: 40, approvedDocs: 1 });
    expect(one?.en).toBe('1 document, 40% complete on average · 1 approved');
    expect(one?.el).toBe('1 έγγραφο, κατά μέσο όρο 40% ολοκληρωμένα · 1 εγκεκριμένο');

    const many = readinessEvidence('artifactCompleteness', { docCount: 5, avgCompletion: 61, approvedDocs: 0 });
    expect(many?.en).toBe('5 documents, 61% complete on average');
    expect(many?.el).toBe('5 έγγραφα, κατά μέσο όρο 61% ολοκληρωμένα');

    const oneReview = readinessEvidence('executionReadiness', { completedReviews: 1, totalReviews: 1, approvalRate: 1 });
    expect(oneReview?.el).toBe('1 από 1 αξιολόγηση εγκρίθηκε (100%)');
    const manyReviews = readinessEvidence('executionReadiness', { completedReviews: 2, totalReviews: 4, approvalRate: 0.5 });
    expect(manyReviews?.el).toBe('2 από 4 αξιολογήσεις εγκρίθηκαν (50%)');

    const oneRound = readinessEvidence('validationScore', { feedbackCount: 1, appliedRate: 0.5 });
    expect(oneRound?.el).toBe('1 γύρος ανατροφοδότησης, 50% εφαρμόστηκε');
    const manyRounds = readinessEvidence('validationScore', { feedbackCount: 8, appliedRate: 0.63 });
    expect(manyRounds?.el).toBe('8 γύροι ανατροφοδότησης, 63% εφαρμόστηκε');
  });

  it('says what is missing rather than reporting a zero', () => {
    // "0 documents, 0% complete" reads as a measurement. It is an absence, and
    // an absence is the one thing a founder can act on immediately.
    expect(readinessEvidence('artifactCompleteness', { docCount: 0, avgCompletion: 0, approvedDocs: 0 })?.el)
      .toBe('Κανένα έγγραφο ακόμη');
    expect(readinessEvidence('marketUnderstanding', { docType: '', completion: 0 })?.el)
      .toBe('Δεν υπάρχει ακόμη ανάλυση αγοράς');
    expect(readinessEvidence('teamCompleteness', { memberCount: 1, collaborators: 0 })?.el)
      .toBe('Μόνο ο ιδρυτής — κανένας συνεργάτης ακόμη');
    expect(readinessEvidence('executionReadiness', { completedReviews: 0, totalReviews: 0, approvalRate: 0 })?.el)
      .toBe('Δεν έχει ζητηθεί ακόμη αξιολόγηση');
  });

  it('names the document without needing it to agree with an article', () => {
    // Deliberately colon-shaped: the eight document names span all three
    // genders, so "Ο Πυρήνας ιδέας είναι ολοκληρωμένος" would need three forms.
    const e = readinessEvidence('problemClarity', { docType: 'idea_core', completion: 50, approved: true });
    expect(e?.en).toBe('Idea Core: 50% complete · approved');
    expect(e?.el).toBe('Πυρήνας ιδέας: ολοκλήρωση 50% · εγκεκριμένο');
  });

  it('falls back to the service diagnostic rather than to nothing', () => {
    // A dimension the service grows later still says something true.
    const e = readinessEvidence('somethingNew', {}, 'raw_signal at 12%');
    expect(e).toEqual({ en: 'raw_signal at 12%', el: 'raw_signal at 12%' });
    expect(readinessEvidence('somethingNew', {}, null)).toBeNull();
  });
});
