import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readNaturalSearch } from '@cofounderbay/shared';
import { resolvePreviewApi } from '@/lib/preview-api';
import { WhatsNewPanel, whatsNewItems, type WhatsNewAudience } from './WhatsNewPanel';

/**
 * "What's new": every entry opens a page that exists, each audience sees
 * what it can use, and hiding it is remembered.
 */

afterEach(cleanup);
beforeEach(() => window.localStorage.clear());

const APP = resolve(__dirname, '../../app');
const pageExists = (href: string) => {
  const path = href.split('#')[0].split('?')[0];
  return existsSync(resolve(APP, `.${path}`, 'page.tsx'));
};

describe('what is new', () => {
  it('links only to pages that exist', () => {
    for (const audience of ['founder', 'investor', 'mentor', 'org', 'provider'] as WhatsNewAudience[]) {
      for (const item of whatsNewItems(audience)) expect(pageExists(item.href), item.href).toBe(true);
    }
  });

  it('shows founders the need cards and the scout, and investors neither', () => {
    const founder = whatsNewItems('founder').map((i) => i.href);
    expect(founder).toEqual(expect.arrayContaining(['/commitments/new', '/scout', '/intros', '/transparency']));
    const investor = whatsNewItems('investor').map((i) => i.href);
    expect(investor).not.toContain('/scout');
    expect(investor).toEqual(expect.arrayContaining(['/updates', '/intros', '/settings#verification']));
  });

  it('can be hidden, and stays hidden', () => {
    render(<WhatsNewPanel audience="founder" />);
    expect(screen.getByRole('heading', { name: /What’s new/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Hide/ }));
    expect(screen.queryByRole('heading', { name: /What’s new/ })).toBeNull();
    cleanup();
    render(<WhatsNewPanel audience="founder" />);
    expect(screen.queryByRole('heading', { name: /What’s new/ })).toBeNull();
  });
});

describe('the search example it advertises', () => {
  // The panel said to type "co-founder fintech Thessaloniki part-time"; the
  // demo directory has nobody like that, so following it showed an empty
  // page. The example now has to find someone where people try it.
  const discover = whatsNewItems('founder').find((i) => i.href === '/discover')!;
  const quoted = (text: string) => /["«](.+?)["»]/.exec(text)?.[1] ?? '';

  it.each([['en', quoted(discover.hintEn)], ['el', quoted(discover.hintEl)]])('finds someone in the demo (%s)', (_lang, example) => {
    expect(example.length).toBeGreaterThan(0);
    const read = readNaturalSearch(example);
    expect(read.understood.length).toBeGreaterThan(1);
    const sp = new URLSearchParams();
    if (read.rest) sp.set('q', read.rest);
    if (read.roles.length) sp.set('roles', read.roles.join(','));
    if (read.industries.length) sp.set('industries', read.industries.join(','));
    if (read.location) sp.set('location', read.location);
    if (read.availability.length) sp.set('commitment', read.availability.join(','));
    const res = resolvePreviewApi(`/api/search/profiles?${sp.toString()}`) as { hits: unknown[] };
    expect(res.hits.length).toBeGreaterThan(0);
  });
});
