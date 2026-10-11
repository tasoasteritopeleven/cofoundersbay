// Codemod: a sentence or a description rendered as one-line `compact`
// BilingualText gets `wrap`. Controls (buttons, tabs, options, badges) keep
// their single line.
const fs = require('fs');
const path = require('path');
const walk = (d) => fs.readdirSync(d).flatMap((e) => {
  const f = path.join(d, e);
  return fs.statSync(f).isDirectory() ? walk(f) : e.endsWith('.tsx') && !e.includes('.test.') ? [f] : [];
});
const RE = /(<CardDescription[^>]*>|<DialogDescription[^>]*>|<SheetDescription[^>]*>|description=\{|)(\s*)<BilingualText\b([^>]*?)\/>/g;
let n = 0, skipped = 0;
const touched = [];
for (const f of [...walk('src/app'), ...walk('src/components')]) {
  const t = fs.readFileSync(f, 'utf8');
  let changed = false;
  const out = t.replace(RE, (all, wrapper, ws, attrs, off) => {
    if (!/\bcompact\b/.test(attrs) || /\bwrap\b/.test(attrs)) return all;
    const en = /en="([^"]*)"/.exec(attrs)?.[1];
    const words = en ? en.trim().split(/\s+/).length : 0;
    const sentence = en && (words >= 7 || (/[.?!]\s*$/.test(en) && words >= 4));
    if (!wrapper && !sentence) return all;
    const line = t.slice(t.lastIndexOf('\n', off) + 1, off);
    if (/<(Button|button|SelectItem|option|TabsTrigger|DropdownMenuItem|Badge)\b/.test(line)) { skipped++; return all; }
    n++; changed = true;
    return all.replace(/\bcompact\b/, 'compact wrap');
  });
  if (changed) { fs.writeFileSync(f, out); touched.push(f.split(path.sep).join('/')); }
}
console.log(`wrapped ${n}, skipped (controls) ${skipped}, files ${touched.length}`);
touched.forEach((f) => console.log('  ' + f));
