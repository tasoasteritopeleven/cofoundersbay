import { builderDocLabel } from '@/lib/i18n/strings-builder';

/**
 * Why a readiness dimension scores what it scores, in a sentence a founder can
 * read.
 *
 * The service already answers with everything needed: each dimension carries a
 * `signals` object of the raw facts it used (`{docCount, avgCompletion,
 * approvedDocs}`, `{memberCount, collaborators}`, and so on). What it also
 * carries is `detail` — a diagnostic string written for whoever was debugging
 * the formula: `idea_core at 50%`, `inferred (40% of problemClarity)`,
 * `2/4 reviews approved (50% rate)`. That is the string the panel was printing.
 *
 * It is the wrong string twice over. It is not a sentence, and it is English in
 * a product where every other label is bilingual — so the one place that
 * explains a founder's score was the one place half the readers could not read.
 * The preview had quietly papered over it by inventing prose of its own
 * ("Problem statement written and reviewed") that the live product never
 * produces, which made the showcase a promise the product does not keep.
 *
 * So the facts stay in the API and the wording lives here, beside every other
 * translated string. `detail` is kept as the fallback for a dimension whose
 * signals are missing or that the service grows later — nothing is lost, and an
 * unknown key degrades to the diagnostic rather than to nothing.
 */

export type DimensionSignals = Record<string, string | number | boolean>;

export type Evidence = { en: string; el: string };

function num(signals: DimensionSignals, key: string): number {
  const v = signals[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function str(signals: DimensionSignals, key: string): string {
  const v = signals[key];
  return typeof v === 'string' ? v : '';
}

function pct(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * A document's name, then a colon, then the figure.
 *
 * Deliberately not "Ο Πυρήνας ιδέας είναι 50% ολοκληρωμένος": the eight
 * document names are masculine, feminine and neuter, so a sentence with an
 * article and a participle needs three agreement forms per dimension. The colon
 * carries the same meaning and agrees with nothing.
 */
function docLine(docType: string, completion: number, suffix?: Evidence): Evidence {
  const en = `${builderDocLabel(docType, 'en')}: ${pct(completion)} complete`;
  const el = `${builderDocLabel(docType, 'el')}: ολοκλήρωση ${pct(completion)}`;
  return suffix
    ? { en: `${en} · ${suffix.en}`, el: `${el} · ${suffix.el}` }
    : { en, el };
}

export function readinessEvidence(
  key: string,
  signals: DimensionSignals | null | undefined,
  fallback?: string | null,
): Evidence | null {
  const s = signals ?? {};
  const known = Object.keys(s).length > 0;

  switch (known ? key : '') {
    case 'artifactCompleteness': {
      const docs = num(s, 'docCount');
      if (docs === 0) return { en: 'No documents yet', el: 'Κανένα έγγραφο ακόμη' };
      const approved = num(s, 'approvedDocs');
      const avg = pct(num(s, 'avgCompletion'));
      const en = `${docs} ${docs === 1 ? 'document' : 'documents'}, ${avg} complete on average`;
      const el = `${docs} ${docs === 1 ? 'έγγραφο' : 'έγγραφα'}, κατά μέσο όρο ${avg} ολοκληρωμένα`;
      if (approved === 0) return { en, el };
      return {
        en: `${en} · ${approved} approved`,
        el: `${el} · ${approved} ${approved === 1 ? 'εγκεκριμένο' : 'εγκεκριμένα'}`,
      };
    }

    case 'problemClarity': {
      const type = str(s, 'docType');
      if (!type) return { en: 'No problem document yet', el: 'Δεν υπάρχει ακόμη έγγραφο προβλήματος' };
      return docLine(
        type,
        num(s, 'completion'),
        s.approved === true ? { en: 'approved', el: 'εγκεκριμένο' } : undefined,
      );
    }

    case 'solutionClarity': {
      if (s.inferred === true) {
        return {
          en: 'Inferred from problem clarity — no MVP plan yet',
          el: 'Υπολογίζεται από τη σαφήνεια προβλήματος — δεν υπάρχει ακόμη σχέδιο MVP',
        };
      }
      const type = str(s, 'docType');
      if (!type) return { en: 'No solution document yet', el: 'Δεν υπάρχει ακόμη έγγραφο λύσης' };
      return docLine(type, num(s, 'completion'));
    }

    case 'marketUnderstanding': {
      const type = str(s, 'docType');
      if (!type) return { en: 'No market analysis yet', el: 'Δεν υπάρχει ακόμη ανάλυση αγοράς' };
      return docLine(type, num(s, 'completion'));
    }

    case 'productDefinition': {
      const type = str(s, 'docType');
      if (!type) return { en: 'No product document yet', el: 'Δεν υπάρχει ακόμη έγγραφο προϊόντος' };
      return docLine(type, num(s, 'completion'));
    }

    case 'teamCompleteness': {
      const members = num(s, 'memberCount');
      if (members <= 1) {
        return { en: 'Founder only — no collaborators yet', el: 'Μόνο ο ιδρυτής — κανένας συνεργάτης ακόμη' };
      }
      return {
        en: `${members} workspace members`,
        el: `${members} μέλη στον χώρο εργασίας`,
      };
    }

    case 'executionReadiness': {
      const total = num(s, 'totalReviews');
      if (total === 0) return { en: 'No reviews requested yet', el: 'Δεν έχει ζητηθεί ακόμη αξιολόγηση' };
      const done = num(s, 'completedReviews');
      const rate = pct(num(s, 'approvalRate') * 100);
      return {
        en: `${done} of ${total} ${total === 1 ? 'review' : 'reviews'} approved (${rate})`,
        el: `${done} από ${total} ${total === 1 ? 'αξιολόγηση εγκρίθηκε' : 'αξιολογήσεις εγκρίθηκαν'} (${rate})`,
      };
    }

    case 'validationScore': {
      const rounds = num(s, 'feedbackCount');
      if (rounds === 0) return { en: 'No mentor feedback yet', el: 'Καμία ανατροφοδότηση μέντορα ακόμη' };
      const applied = pct(num(s, 'appliedRate') * 100);
      return {
        en: `${rounds} feedback ${rounds === 1 ? 'round' : 'rounds'}, ${applied} applied`,
        el: `${rounds} ${rounds === 1 ? 'γύρος' : 'γύροι'} ανατροφοδότησης, ${applied} εφαρμόστηκε`,
      };
    }

    default:
      // A dimension the service grows later, or one whose signals did not
      // arrive. The diagnostic is poor copy but it is true, and showing it
      // beats showing nothing.
      return fallback ? { en: fallback, el: fallback } : null;
  }
}
