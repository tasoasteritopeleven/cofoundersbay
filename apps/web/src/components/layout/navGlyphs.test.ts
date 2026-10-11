import { describe, expect, it } from 'vitest';
import { Bot } from 'lucide-react';
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
  modeForPath,
  tenantWorkSections,
  type NavSection,
} from './nav-modes';
import { glyphForHref, sectionNavGlyphs, specificGlyphForHref } from '@/components/icons/CfbGlyph';

/**
 * An icon in a nav list is there to be told apart from its neighbours. Every
 * page under /admin used to resolve to the shield, so an admin's sidebar was
 * fifteen identical marks; org and tenant had one glyph for ten and twelve
 * links. These checks draw each list the way SideNav and MobileNav do and
 * fail when two entries in one list would wear the same icon.
 */

const LISTS: Record<string, NavSection[]> = {
  founder: founderWorkSections,
  mentor: mentorWorkSections,
  investor: investorWorkSections,
  provider: providerWorkSections,
  org: orgWorkSections,
  admin: adminWorkSections,
  tenant: tenantWorkSections,
  default: defaultWorkSections,
  explore: exploreSections,
  account: accountSections,
};

/** What a list draws for each entry: a named glyph, or the entry's own icon. */
function drawn(sections: NavSection[]) {
  const glyphs = sectionNavGlyphs(sections);
  return sections.flatMap((section, s) =>
    section.links.map((link, l) => ({
      label: `${section.section}/${link.label}`,
      mark: glyphs[s][l] ?? (link.href === '/ai' ? Bot : link.icon),
    })),
  );
}

describe('nav list icons', () => {
  it.each(Object.keys(LISTS))('gives every entry in the %s list its own icon', (name) => {
    const seen = new Map<unknown, string>();
    const clashes: string[] = [];
    for (const { label, mark } of drawn(LISTS[name])) {
      const earlier = seen.get(mark);
      if (earlier) clashes.push(`${earlier} = ${label}`);
      else seen.set(mark, label);
    }
    expect(clashes).toEqual([]);
  });

  it('names a page in a section by its own last segment', () => {
    expect(specificGlyphForHref('/admin/analytics')).toBe('chart');
    expect(specificGlyphForHref('/org/cohorts')).toBe('community');
    expect(specificGlyphForHref('/settings/billing')).toBe('wallet');
    expect(specificGlyphForHref('/mentor/profile')).toBe('profile');
    expect(specificGlyphForHref('/dashboard/founder')).toBe('home');
  });

  it("leaves a family page without a glyph of its own to its entry's icon, and keeps the family mark elsewhere", () => {
    expect(specificGlyphForHref('/admin/sso')).toBeUndefined();
    expect(specificGlyphForHref('/settings/data-export')).toBeUndefined();
    // Headers, breadcrumbs and the assistant's link list still get a mark.
    expect(glyphForHref('/admin/sso')).toBe('shield');
    expect(glyphForHref('/groups/abc123')).toBe('community');
  });
});

describe('the sidebar mode follows the page', () => {
  it('shows the list a page lives in, and keeps the mode for pages in no list', () => {
    expect(modeForPath('/discover', 'work', 'existing_founder')).toBe('explore');
    expect(modeForPath('/settings/billing', 'work', 'existing_founder')).toBe('account');
    expect(modeForPath('/dashboard/founder', 'account', 'existing_founder')).toBe('work');
    // In the current mode's list already: no jump, even if another list has it too.
    expect(modeForPath('/ai', 'explore', 'existing_founder')).toBe('explore');
    expect(modeForPath('/ai', 'work', 'existing_founder')).toBe('work');
    // In no list: the reader's choice stands.
    expect(modeForPath('/profiles/user-elena', 'explore', 'existing_founder')).toBe('explore');
  });
});
