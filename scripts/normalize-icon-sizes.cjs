#!/usr/bin/env node
/**
 * One-off migration: raw `h-N w-N` on icon elements -> `.icon-*` utilities.
 *
 * The project standard (globals.css) is icon-sm 16 / icon-md 20 / icon-lg 24 /
 * icon-xl 32. Roughly 2,300 icons still used raw sizes, including 12px and 14px
 * glyphs that fall below the standard and read as visual noise.
 *
 * Only self-closing, capitalised JSX tags are touched (lucide icons are always
 * written that way), and a deny-list keeps layout primitives (Avatar, Skeleton,
 * Progress, ...) untouched. Elements whose class list includes `rounded` are
 * skipped too, since a 12px rounded-full span is a status dot, not an icon.
 *
 * Usage: node scripts/normalize-icon-sizes.cjs [--dry]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'apps', 'web', 'src');
const DRY = process.argv.includes('--dry');

const DENY = new Set([
  'Avatar', 'AvatarImage', 'AvatarFallback', 'Skeleton', 'Progress', 'Button', 'Card',
  'Badge', 'Switch', 'Checkbox', 'Input', 'Textarea', 'Select', 'Slider', 'Image',
  'Logo', 'Spinner', 'Separator', 'ScrollArea', 'RadioGroupItem', 'TabsTrigger',
  'DialogContent', 'PopoverContent', 'TooltipContent', 'Link', 'OptimizedLink',
]);

const SIZE_MAP = [
  [/\b(?:h-3 w-3|w-3 h-3|h-3\.5 w-3\.5|w-3\.5 h-3\.5|h-4 w-4|w-4 h-4)\b/g, 'icon-sm'],
  [/\b(?:h-5 w-5|w-5 h-5)\b/g, 'icon-md'],
  [/\b(?:h-6 w-6|w-6 h-6)\b/g, 'icon-lg'],
  [/\b(?:h-8 w-8|w-8 h-8)\b/g, 'icon-xl'],
];

// <Name ... /> self-closing, capitalised
const TAG = /<([A-Z][A-Za-z0-9.]*)(\s[^<>]*?)\/>/g;

let files = 0, replaced = 0;

function rewriteTag(whole, name, attrs) {
  const base = name.split('.').pop();
  if (DENY.has(base)) return whole;
  return whole.replace(/className=(["'])([^"']*)\1|className=\{cn\(([\s\S]*?)\)\}|className=\{`([^`]*)`\}/g, (attr) => {
    if (/\brounded/.test(attr)) return attr;
    let out = attr;
    for (const [re, util] of SIZE_MAP) {
      out = out.replace(re, () => { replaced++; return util; });
    }
    return out;
  });
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.tsx$/.test(e.name)) continue;
    const src = fs.readFileSync(p, 'utf8');
    const out = src.replace(TAG, rewriteTag);
    if (out !== src) { files++; if (!DRY) fs.writeFileSync(p, out, 'utf8'); }
  }
}

walk(ROOT);
console.log(`${DRY ? '[dry] ' : ''}files: ${files}, icon sizes normalised: ${replaced}`);
