import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/app/globals.css', 'utf8');

describe('phone touch floor', () => {
  it('lifts undersized controls only below the tablet breakpoint', () => {
    const start = css.indexOf('Call sites pin h-7');
    expect(start).toBeGreaterThan(0);
    const before = css.slice(0, start);
    const mediaStart = before.lastIndexOf('@media');
    const media = before.slice(mediaStart, start);
    expect(media).toContain('max-width: 639.98px');
    expect(media).not.toContain('min-width');
    const rule = css.slice(start, css.indexOf('.tap-target-y', start));
    expect(rule).toContain('min-height: 31.08px');
    expect(rule).toContain('.h-7');
    expect(rule).toContain('.h-8');
    expect(rule).toContain('.h-9');
    expect(rule).toContain('.h-10');
    expect(rule).toContain('.h-11');
    expect(rule).toContain('.w-7');
    expect(rule).toContain('.w-11');
    const phone = css.slice(mediaStart, css.indexOf('Reading measure', start));
    expect(phone).toContain('select');
    expect(phone).toMatch(/select[\s\S]*min-height:\s*44px/);
  });
});
