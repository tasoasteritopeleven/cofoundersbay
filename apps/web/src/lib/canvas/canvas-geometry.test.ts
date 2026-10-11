import { describe, expect, it } from 'vitest';
import { hugBounds, parseNudge, parseScale, tidyRects, resolveNoteFill, nodePaintColor, readCfbHref, applyPaintToMetadata, fillContrastText, mergeNodeMetadata } from './canvas-geometry';

describe('tidyRects', () => {
  it('packs along the wider axis with a 16px gap', () => {
    const updates = tidyRects([
      { id: 'a', posX: 0, posY: 10, width: 100, height: 40 },
      { id: 'b', posX: 400, posY: 80, width: 80, height: 40 },
    ]);
    expect(updates).toEqual([
      { id: 'a', posX: 0, posY: 10 },
      { id: 'b', posX: 116, posY: 10 },
    ]);
  });
});

describe('parseNudge', () => {
  it('reads a pair and named directions', () => {
    expect(parseNudge('12,-4')).toEqual({ dx: 12, dy: -4 });
    expect(parseNudge('left')).toEqual({ dx: -1, dy: 0 });
    expect(parseNudge('shift right')).toEqual({ dx: 10, dy: 0 });
    expect(parseNudge('αριστερά')).toEqual({ dx: -1, dy: 0 });
  });
});

describe('hugBounds / parseScale', () => {
  it('pads the selection box and scales up by default', () => {
    expect(hugBounds([{ id: 'a', posX: 10, posY: 20, width: 100, height: 50 }], 10)).toEqual({
      posX: 0,
      posY: 10,
      width: 120,
      height: 80,
    });
    expect(parseScale('up')).toBe(1.1);
    expect(parseScale('0.5')).toBe(0.5);
  });
});

describe('resolveNoteFill', () => {
  it('matches either the wash or the accent so inspector and stickies share a colour', () => {
    expect(resolveNoteFill('#FEF3C7').accent).toBe('#F59E0B');
    expect(resolveNoteFill('#F59E0B').fill).toBe('#FEF3C7');
    expect(resolveNoteFill('#00ff00')).toEqual({ fill: '#00ff00', accent: '#00ff00' });
  });
});

describe('nodePaintColor / applyPaintToMetadata / readCfbHref', () => {
  it('resolves inspector fills from color or shape fillColor', () => {
    expect(nodePaintColor('#F59E0B')).toBe('#FEF3C7');
    expect(nodePaintColor(null, { fillColor: '#DBEAFE' })).toBe('#DBEAFE');
    expect(nodePaintColor(undefined, {})).toBeUndefined();
  });

  it('writes the same fill onto style-backed notes and shape metadata', () => {
    const next = applyPaintToMetadata({ fillColor: '#111111' }, { fill: '#D1FAE5', opacity: 0.8, stroke: '#10B981' });
    expect(next.fillColor).toBe('#D1FAE5');
    expect(next.strokeColor).toBe('#10B981');
    expect(next.opacity).toBe(0.8);
    expect((next.style as { opacity: number; stroke: string }).opacity).toBe(0.8);
    expect((next.style as { opacity: number; stroke: string }).stroke).toBe('#10B981');
  });

  it('only accepts in-app product hrefs', () => {
    expect(readCfbHref({ cfbLink: { href: '/readiness' } })).toBe('/readiness');
    expect(readCfbHref({ cfbLink: { href: 'https://evil.example' } })).toBeUndefined();
    expect(readCfbHref({ cfbLink: { href: '//evil.example' } })).toBeUndefined();
  });

  it('picks dark type on pastel fills', () => {
    expect(fillContrastText('#FEF3C7')).toBe('#1E293B');
    expect(fillContrastText('#3B82F6')).toBe('#FFFFFF');
  });

  it('merges product links with rotate instead of last-write-wins', () => {
    const linked = mergeNodeMetadata({ cfbLink: { href: '/builder?tab=idea' }, votes: 1 }, { style: { rotate: 90 } });
    expect(readCfbHref(linked)).toBe('/builder?tab=idea');
    expect((linked.style as { rotate: number }).rotate).toBe(90);
    expect(linked.votes).toBe(1);
  });
});
