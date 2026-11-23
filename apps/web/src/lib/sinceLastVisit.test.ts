import { beforeEach, describe, expect, it } from 'vitest';
import { readLastVisit, sinceLastVisit } from './since-last-visit';

const at = (iso: string, type: string) => ({ type, createdAt: iso });
const last = Date.parse('2026-11-05T12:00:00Z');

describe('what is new since the last visit', () => {
  beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });

  it('says nothing on a first visit', () => {
    expect(sinceLastVisit([at('2026-11-06T10:00:00Z', 'message')], null)).toBeNull();
  });

  it('says nothing on a quiet day', () => {
    expect(sinceLastVisit([at('2026-11-04T10:00:00Z', 'message')], last)).toBeNull();
  });

  it('counts only what arrived after, by kind, messages first', () => {
    const line = sinceLastVisit([
      at('2026-11-04T10:00:00Z', 'message'),
      at('2026-11-06T10:00:00Z', 'system'),
      at('2026-11-06T11:00:00Z', 'connection_request'),
      at('2026-11-06T12:00:00Z', 'message'),
      at('2026-11-06T13:00:00Z', 'message'),
      at('2026-11-06T14:00:00Z', 'match_suggestion'),
    ], last);
    expect(line?.el).toBe('Από την τελευταία φορά: μηνύματα 2 · άτομα 1 · αντιστοιχίσεις 1 · άλλα 1');
    expect(line?.en).toBe('Since your last visit: messages 2 · people 1 · matches 1 · other 1');
  });

  it('remembers the previous visit, and a reload keeps the same line', () => {
    expect(readLastVisit('reader', false, 1000)).toBeNull();
    window.sessionStorage.clear();
    expect(readLastVisit('reader', false, 2000)).toBe(1000);
    expect(readLastVisit('reader', false, 3000)).toBe(1000);
    expect(window.localStorage.getItem('cfb.home.lastVisit:member:reader')).toBe('2000');
    expect(readLastVisit('reader', true, 3000)).toBeNull();
    expect(readLastVisit('other', false, 3000)).toBeNull();
  });

  it('does not count a duplicate id or an unreadable timestamp', () => {
    const item = { ...at('2026-11-06T10:00:00Z', 'message'), id: 'same' };
    expect(sinceLastVisit([item, item, at('invalid', 'message')], last)?.en).toBe('Since your last visit: messages 1');
  });
});
