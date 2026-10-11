#!/usr/bin/env node
/**
 * One-off migration: hardcoded Tailwind palette classes -> semantic status tokens.
 *
 * Why: the app ships 5 themes (light, dark, alliance, cofounder, system) and a
 * token layer (--status-*-fg/bg/border) that adapts contrast per theme. ~3,000
 * call sites bypassed it with raw palette classes (text-emerald-600,
 * dark:text-emerald-400, bg-amber-50 ...) which only look right on light+dark.
 *
 * Scope (deliberately conservative):
 *   text-{fam}-{500..800}                -> text-status-{tone}
 *   bg-{fam}-{50,100} | bg-{fam}-N/alpha -> bg-status-{tone}-bg
 *   border-{fam}-{200,300} | /alpha      -> border-status-{tone}-border
 *   stroke-/fill-{fam}-{400..600}        -> stroke-/fill-status-{tone}
 *   dark:text-/bg-/border- variants of the above are dropped when the same
 *   class string already carries the mapped token (the token is theme-aware).
 *   gray/slate/zinc/neutral/stone        -> foreground / muted-foreground / muted / border
 *
 * NOT touched (need a human): solid fills (bg-{fam}-500 with white text),
 * gradients (from-/to-/via-), ring-, shadow-, and the research canvas colour
 * pickers where raw hues are user data.
 *
 * Usage: node scripts/migrate-palette-to-tokens.cjs [--dry]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'apps', 'web', 'src');
const DRY = process.argv.includes('--dry');

const TONE = {
  emerald: 'success', green: 'success', teal: 'success', lime: 'success',
  amber: 'warning', yellow: 'warning', orange: 'warning',
  red: 'danger', rose: 'danger',
  blue: 'info', sky: 'info', cyan: 'info',
  purple: 'accent', violet: 'accent', indigo: 'accent', fuchsia: 'accent', pink: 'accent',
};
const GRAYS = new Set(['gray', 'slate', 'zinc', 'neutral', 'stone']);

const SKIP_DIRS = new Set(['research', 'canvas']); // raw hues are user-chosen data there
const CLASS_ATTR = /(className|class)\s*=\s*("([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{cn\(([\s\S]*?)\)\})/g;

let filesChanged = 0, replaced = 0, dropped = 0;

function mapToken(tok) {
  // Variants: `dark:` is dropped when the theme-aware token is present; any other
  // state variant (hover:, focus:, group-hover:, …) is preserved as a prefix.
  const m = tok.match(/^((?:[a-z-]+:)*)(text|bg|border|stroke|fill)-([a-z]+)-(\d{2,3})(\/\d{1,3})?$/);
  if (!m) return null;
  const [, variants, prop, fam, shadeStr, alpha] = m;
  const shade = Number(shadeStr);
  const dark = /(^|:)dark:/.test(variants);
  const prefix = variants.replace(/dark:/g, '');

  if (GRAYS.has(fam)) {
    if (dark) return { out: null, drop: true };
    if (prop === 'text') return { out: prefix + (shade >= 700 ? 'text-foreground' : 'text-muted-foreground') };
    if (prop === 'bg' && shade <= 100) return { out: prefix + 'bg-muted' };
    if (prop === 'border' && shade <= 300) return { out: prefix + 'border-border' };
    return null;
  }

  const tone = TONE[fam];
  if (!tone) return null;

  if (prop === 'text') {
    if (dark) return { out: null, drop: true, needs: `${prefix}text-status-${tone}` };
    if (shade >= 500 && shade <= 800) return { out: `${prefix}text-status-${tone}` };
    return null;
  }
  if (prop === 'bg') {
    if (dark) return { out: null, drop: true, needs: `${prefix}bg-status-${tone}-bg` };
    if (shade <= 100 || alpha) return { out: `${prefix}bg-status-${tone}-bg` };
    return null; // solid fill — leave
  }
  if (prop === 'border') {
    if (dark) return { out: null, drop: true, needs: `${prefix}border-status-${tone}-border` };
    if (shade <= 300 || alpha) return { out: `${prefix}border-status-${tone}-border` };
    return null;
  }
  if (prop === 'stroke' || prop === 'fill') {
    if (dark) return { out: null, drop: true, needs: `${prefix}${prop}-status-${tone}` };
    if (shade >= 400 && shade <= 600) return { out: `${prefix}${prop}-status-${tone}` };
    return null;
  }
  return null;
}

/** Rewrite one whitespace-separated class list. */
function rewriteClassList(list) {
  const toks = list.split(/(\s+)/); // keep whitespace
  const mapped = toks.map((t) => (/^\s+$/.test(t) || t === '' ? t : (mapToken(t) || { out: t })));
  const present = new Set(mapped.filter((x) => x.out).map((x) => x.out));
  let out = '';
  for (let i = 0; i < mapped.length; i++) {
    const m = mapped[i];
    if (typeof m === 'string') { out += m; continue; }
    if (m.drop) {
      // drop only if the mapped light token exists (theme-aware), else keep original
      if (!m.needs || present.has(m.needs)) { dropped++; if (/^\s+$/.test(toks[i + 1] || '')) i++; continue; }
      out += toks[i]; continue;
    }
    if (m.out !== toks[i]) replaced++;
    out += m.out;
  }
  return out;
}

function processSource(src) {
  // Rewrite inside any string literal that looks like a class list.
  return src.replace(/(["'`])((?:(?!\1)[^\\]|\\.)*?)\1/g, (whole, q, body) => {
    if (!/(?:^|\s)(?:[a-z-]+:)*(?:text|bg|border|stroke|fill)-[a-z]+-\d{2,3}/.test(body)) return whole;
    if (body.includes('${')) {
      // template literal: rewrite only the static parts
      const parts = body.split(/(\$\{[^}]*\})/);
      return q + parts.map((p) => (p.startsWith('${') ? p : rewriteClassList(p))).join('') + q;
    }
    return q + rewriteClassList(body) + q;
  });
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p); continue; }
    if (!/\.(tsx|ts)$/.test(e.name)) continue;
    const src = fs.readFileSync(p, 'utf8');
    const out = processSource(src);
    if (out !== src) {
      filesChanged++;
      if (!DRY) fs.writeFileSync(p, out, 'utf8');
    }
  }
}

walk(ROOT);
console.log(`${DRY ? '[dry] ' : ''}files: ${filesChanged}, tokens replaced: ${replaced}, dark: duplicates dropped: ${dropped}`);
