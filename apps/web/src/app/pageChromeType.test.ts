import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guards chrome type: geometric 1.08 from the 12.2412px caption floor.
 *
 * Claude `b05b51b8` last push (22.12 / 21.13 / 19.21 / 12.35) is larger
 * and spans 9.77px. This file locks the smaller tight set instead.
 */

const CSS = readFileSync('src/app/globals.css', 'utf8');
const BROWSER_DEFAULT_PX = 16;
const DESKTOP_ROOT_PX = 0.82 * BROWSER_DEFAULT_PX;
const FLOOR_PX = 12.2412;
const RATIO = 1.08;

function evalCalc(expr: string, rootPx: number): number {
  return expr.split('*').reduce((product, part) => {
    const token = part.trim();
    const rem = /^([\d.]+)rem$/.exec(token);
    if (rem) return product * Number(rem[1]) * rootPx;
    const px = /^([\d.]+)px$/.exec(token);
    if (px) return product * Number(px[1]);
    return product * Number(token);
  }, 1);
}

function toPx(value: string, rootPx: number): number {
  const maxCalc = /max\(\s*([\d.]+)px\s*,\s*calc\(([^)]+)\)\s*\)/.exec(value);
  if (maxCalc) return Math.max(Number(maxCalc[1]), evalCalc(maxCalc[2], rootPx));

  const maxRem = /max\(\s*([\d.]+)px\s*,\s*([\d.]+)rem\s*\)/.exec(value);
  if (maxRem) return Math.max(Number(maxRem[1]), Number(maxRem[2]) * rootPx);

  const remPx = /max\(\s*([\d.]+)rem\s*,\s*([\d.]+)px\s*\)/.exec(value);
  if (remPx) return Math.max(Number(remPx[1]) * rootPx, Number(remPx[2]));

  const calc = /^calc\((.+)\)$/.exec(value);
  if (calc) return evalCalc(calc[1], rootPx);

  const rem = /^([\d.]+)rem$/.exec(value);
  if (rem) return Number(rem[1]) * rootPx;

  throw new Error(`Cannot resolve chrome size "${value}"`);
}

function chromeCss(): string {
  const from = CSS.indexOf('App chrome type');
  if (from < 0) throw new Error('Missing App chrome type block');
  return CSS.slice(from);
}

function firstFontSize(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = new RegExp(`${escaped}(?=[\\s,{])[\\s\\S]*?\\{([^}]*)\\}`).exec(source);
  const value = rule && /font-size:\s*([^;]+)/.exec(rule[1]);
  if (!value) throw new Error(`No font-size for ${selector}`);
  return value[1].trim();
}

function desktopChrome(): string {
  const chrome = chromeCss();
  const start = chrome.indexOf('@media (min-width: 1024px)');
  if (start < 0) throw new Error('Missing desktop chrome media query');
  return chrome.slice(start);
}

describe('page chrome type harmony', () => {
  it('shares the ladder caption floor constant', () => {
    expect(CSS).toMatch(/aside \.text-2xs[\s\S]*?12\.2412px/);
    expect(CSS).toMatch(/p\.page-stat-label[\s\S]*?max\(12\.2412px/);
    expect(CSS).not.toMatch(/font-size:\s*calc\(10\.45px/);
  });

  it('keeps tile labels on the caption floor on phone and desktop', () => {
    const phone = toPx(firstFontSize(chromeCss(), 'p.page-stat-label'), BROWSER_DEFAULT_PX);
    const desktop = toPx(firstFontSize(desktopChrome(), 'p.page-stat-label'), DESKTOP_ROOT_PX);

    expect(phone).toBeCloseTo(FLOOR_PX, 3);
    expect(desktop).toBeCloseTo(FLOOR_PX, 3);
  });

  it('keeps a smaller 1.08 chrome cluster on desktop', () => {
    const desk = desktopChrome();
    const title = toPx(firstFontSize(desk, 'h1.page-title'), DESKTOP_ROOT_PX);
    const stat = toPx(firstFontSize(desk, 'p.page-stat'), DESKTOP_ROOT_PX);
    const section = toPx(firstFontSize(desk, 'h3.page-section'), DESKTOP_ROOT_PX);
    const figure = toPx(firstFontSize(desk, 'p.page-figure'), DESKTOP_ROOT_PX);
    const label = toPx(firstFontSize(desk, 'p.page-stat-label'), DESKTOP_ROOT_PX);
    const tighten = 0.99;

    expect(title).toBeCloseTo(18 * tighten * 0.98, 1);
    expect(stat).toBeCloseTo(title, 5);
    expect(section).toBeCloseTo(FLOOR_PX * RATIO ** 4 * tighten, 1);
    expect(figure).toBeCloseTo(FLOOR_PX * RATIO ** 3 * tighten, 1);
    expect(label).toBeCloseTo(FLOOR_PX, 2);
    expect(title).toBeGreaterThan(section);
    expect(section).toBeGreaterThan(figure);
    expect(figure).toBeGreaterThan(label);
    expect(title - section).toBeLessThanOrEqual(1.5);
    expect(title - label).toBeLessThan(6);
    expect(section / figure).toBeCloseTo(RATIO, 2);
    expect(title).toBeGreaterThan(FLOOR_PX);
  });

  it('caps leftover xl+ inside #main-content at lg and floors 11px', () => {
    const from = CSS.indexOf('App type ceiling');
    if (from < 0) throw new Error('Missing App type ceiling block');
    const block = CSS.slice(from);
    const deskStart = block.indexOf('@media (min-width: 1024px)');
    if (deskStart < 0) throw new Error('Missing desktop type ceiling');
    const desk = block.slice(deskStart);

    const twoXl = toPx(firstFontSize(desk, '#main-content .text-2xl'), DESKTOP_ROOT_PX);

    expect(twoXl).toBeCloseTo(18 * 0.99 * 0.98, 1);
    expect(block).toMatch(/#main-content \.text-\\\[11px\\\][\s\S]*?font-size:\s*12\.2412px/);
    expect(CSS).toMatch(/#main-content \[data-rail-content\] \.text-2xl/);
  });

  it('keeps page-figure below the xl ceiling', () => {
    const from = CSS.indexOf('Chrome roles beat');
    if (from < 0) throw new Error('Missing chrome-over-ceiling block');
    const block = CSS.slice(from);
    const deskStart = block.indexOf('@media (min-width: 1024px)');
    const figure = toPx(firstFontSize(block.slice(deskStart), '#main-content p.page-figure'), DESKTOP_ROOT_PX);
    expect(figure).toBeCloseTo(FLOOR_PX * RATIO ** 3 * 0.99, 1);
    expect(figure).toBeLessThan(18);
  });
});
