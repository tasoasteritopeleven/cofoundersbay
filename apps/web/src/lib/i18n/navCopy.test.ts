import { describe, expect, it } from 'vitest';
import {
  accountSections,
  adminWorkSections,
  defaultWorkSections,
  exploreSections,
  founderWorkSections,
  investorWorkSections,
  mentorWorkSections,
  orgWorkSections,
  providerWorkSections,
  tenantWorkSections,
} from '@/components/layout/nav-modes';
import { NAV_LINK_DESCRIPTIONS } from '@/lib/nav-descriptions';
import { NAV_DESCRIPTION_EL, NAV_LABEL_EL } from './strings-nav';

/**
 * The sidebar names every destination in both languages and says, on hover,
 * what is behind it. A link with no Greek label rendered its English, which
 * the DOM pass then swapped for Greek inside a lang="en" span with no second
 * line (/admin/dashboard, /settings/ai); 29 links had no tooltip at all.
 */

const hrefs = [
  ...new Set(
    [
      founderWorkSections,
      mentorWorkSections,
      investorWorkSections,
      providerWorkSections,
      orgWorkSections,
      adminWorkSections,
      tenantWorkSections,
      defaultWorkSections,
      exploreSections,
      accountSections,
    ].flatMap((sections) => sections.flatMap((s) => s.links.map((l) => l.href))),
  ),
];

describe('sidebar copy', () => {
  it('gives every nav link a Greek label', () => {
    expect(hrefs.filter((h) => !NAV_LABEL_EL[h])).toEqual([]);
  });

  it('gives every nav link a tooltip in both languages', () => {
    expect(hrefs.filter((h) => !NAV_LINK_DESCRIPTIONS[h] || !NAV_DESCRIPTION_EL[h])).toEqual([]);
  });

  it('keeps the Greek tooltips to the glossary', () => {
    // «mentees», «deals», «cohorts», «tenant» sat beside καθοδηγούμενοι,
    // συμφωνίες, κύκλοι and οργανισμός on the pages they point to.
    const LOANWORD =
      /(?<![\p{L}])(?:mentors?|mentees?|mentoring|deals?|cohorts?|tenants?|founders?|incubators?|accelerators?|engagement|KPIs?|RSVPs?|batch)(?![\p{L}])/iu;
    const offenders = Object.entries(NAV_DESCRIPTION_EL)
      .filter(([, v]) => LOANWORD.test(v))
      .map(([k, v]) => `${k} -> ${v}`);
    expect(offenders).toEqual([]);
  });

  it("describes the destination, not the demo's data", () => {
    // The /ai tooltip read «Βοηθός Harbor — … γύρος $750K» for every user.
    const offenders = Object.entries({ ...NAV_LINK_DESCRIPTIONS, ...NAV_DESCRIPTION_EL })
      .filter(([, v]) => /Harbor|\$\d/.test(v))
      .map(([k, v]) => `${k} -> ${v}`);
    expect(offenders).toEqual([]);
  });
});
