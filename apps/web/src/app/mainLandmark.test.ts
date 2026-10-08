import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every page's main landmark is MainLandmark (or the AppShellFrame's own):
 * it carries id="main-content", the skip link's target, and the dedupe. A
 * raw <main> has none of that; on 2026-10-08 /privacy and /terms rendered one
 * and the skip link went nowhere. The rendered check (one main#main-content
 * per route) is `.probes/clarity.mjs`'s landmark column.
 */

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });
}

describe('main landmark', () => {
  it('no page or component writes a raw <main>', () => {
    const offenders = [...pages('src/app'), ...pages('src/components')]
      .filter((file) => !file.endsWith('components/layout/AppShell.tsx'))
      .filter((file) => /<main[\s>]/.test(readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
    expect(offenders).toEqual([]);
  });
});
