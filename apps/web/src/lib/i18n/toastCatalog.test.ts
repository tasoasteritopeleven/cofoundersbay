import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOAST_EL, toastEl } from './strings-toasts';

/**
 * Every fixed toast string has Greek.
 *
 * Toasts are raised from ~360 call sites with English literals. `ToastItem`
 * renders each through `toastEl`, so a Greek reader sees Greek without the
 * call sites changing — as long as the catalog knows the string. This fails
 * on a literal title or description that the catalog does not, which is how a
 * new toast would otherwise ship in English only.
 */

const SRC = 'src';
const CALL = /\b(?:success|toastOk|toastError|toastFail|showError|showSuccess|toastSuccess|error|info|warning|toastWarning|toastInfo|notify)\(\s*'((?:[^'\\]|\\.)*)'(?:\s*,\s*'((?:[^'\\]|\\.)*)')?/g;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry) && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

describe('toast catalog', () => {
  it('has Greek for every literal toast string', () => {
    const missing: string[] = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, 'utf8');
      if (!text.includes('toast') && !text.includes('Toast')) continue;
      for (const m of text.matchAll(CALL)) {
        for (const s of [m[1], m[2]]) {
          if (!s || !/[A-Za-z]{2}/.test(s) || /[Ͱ-Ͽ]/.test(s)) continue;
          if (!toastEl(s)) missing.push(`${file}: ${s}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('translates an appended error through its prefix', () => {
    expect(toastEl('Upload failed: 413')).toBe(`${TOAST_EL['Upload failed:']} 413`);
    expect(toastEl('Saved')).toBe('Αποθηκεύτηκε');
    expect(toastEl('Something nobody wrote')).toBeUndefined();
  });
});
