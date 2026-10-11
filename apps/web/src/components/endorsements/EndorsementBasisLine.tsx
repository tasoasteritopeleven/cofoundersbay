import { ENDORSEMENT_BASIS_COPY, isEndorsementBasis } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';

/**
 * "Worked together: agreed terms" under an endorsement, when the platform can
 * see the relationship it speaks to. Nothing renders without a basis: an
 * endorsement written outside the platform's view keeps working, unlabelled.
 */
export function EndorsementBasisLine({ basis }: { basis?: readonly string[] | null }) {
  const known = (basis ?? []).filter(isEndorsementBasis);
  if (!known.length) return null;
  const first = ENDORSEMENT_BASIS_COPY[known[0]];
  const more = known.slice(1).map((b) => ENDORSEMENT_BASIS_COPY[b]);
  return (
    <p className="text-xs font-medium text-status-success">
      <BilingualText
        en={[first.en, ...more.map((m) => m.en.replace(/^Worked together: /, ''))].join(' · ')}
        el={[first.el, ...more.map((m) => m.el.replace(/^Συνεργάστηκαν: /, ''))].join(' · ')}
        compact
      />
    </p>
  );
}
