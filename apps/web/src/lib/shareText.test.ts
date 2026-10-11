import { describe, expect, it } from 'vitest';
import { briefFromNeedCard, contactKinds, hasPromiseClaims, readScoutBrief } from '@cofounderbay/shared';
import { founderUpdatePost, needCardPost, pitchPost, profilePost } from './share-text';

/**
 * LinkedIn shares (comparison §6.3) and the scout briefed from a need card
 * (§6.11). LinkedIn's official share link takes only a URL, so the text is
 * suggested and copied; it is built from content that already passed the
 * contact and promise rules and adds neither.
 */

const URL = 'https://cofounderbay.example/c/abc123token';

describe('suggested LinkedIn posts', () => {
  const card = { title: 'Technical co-founder for Harbor', missing: 'A technical co-founder who has shipped a B2B product.', exists: 'A working founder workspace with paying pilots.' };

  it('say what is missing and link the public card, in the reader’s language', () => {
    const en = needCardPost(card, URL, 'en');
    expect(en).toContain('We are looking for: A technical co-founder');
    expect(en.endsWith(URL)).toBe(true);
    const el = needCardPost(card, URL, 'el');
    expect(el).toContain('Ψάχνουμε:');
    expect(el).toContain(URL);
  });

  it('add no contact details and no promises of their own', () => {
    for (const lang of ['en', 'el'] as const) {
      for (const text of [needCardPost(card, URL, lang), founderUpdatePost({ title: 'September: twelve interviews' }, URL, lang), pitchPost({ title: 'Harbor' }, URL, lang), profilePost(URL, lang)]) {
        const withoutLink = text.replace(URL, '');
        expect(contactKinds(withoutLink)).toEqual([]);
        expect(hasPromiseClaims(text)).toBe(false);
      }
    }
  });

  it('clip long sentences rather than overflow a post', () => {
    const long = needCardPost({ ...card, missing: 'x'.repeat(500) }, URL, 'en');
    expect(long.split('\n')[0].length).toBeLessThanOrEqual('We are looking for: '.length + 220);
  });
});

describe('the scout briefed from a need card', () => {
  it('takes the role, place, time, stage and the missing sentence, and passes the scout’s own rules', () => {
    const brief = briefFromNeedCard({ offer: { role: 'Co-founder & CTO' }, place: 'Athens', isRemote: true, commitment: 'full_time', stage: 'building', missing: 'Someone who has shipped a B2B product.' });
    expect(brief).toMatchObject({ role: 'Co-founder & CTO', place: 'Athens', remoteOk: true, note: 'Someone who has shipped a B2B product.' });
    expect(readScoutBrief(brief).ok).toBe(true);
  });

  it('drops values the brief does not accept instead of inventing them', () => {
    const brief = briefFromNeedCard({ offer: null, commitment: 'sometimes', stage: 'unicorn' });
    expect(brief).toMatchObject({ role: '', commitment: '', stage: '' });
  });
});
