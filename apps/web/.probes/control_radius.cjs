/*
 * Bare `rounded` is the 6px mark radius. On a clickable control it put a
 * 6px corner beside the 10px every other button, field and row uses, so two
 * controls side by side disagreed about their shape. Lines that are clearly a
 * control (a <button>, a hover background, a tap target) move to `rounded-md`.
 * Native checkboxes/colour inputs and passive marks (code, kbd, skeletons,
 * inline chips) keep 6px - that is what the step is for.
 */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');

function walk(dir) {
  return fs.readdirSync(dir).flatMap((n) => {
    const f = path.join(dir, n);
    return fs.statSync(f).isDirectory() ? walk(f) : /\.tsx$/.test(n) ? [f] : [];
  });
}

const CONTROL = /<button|hover:bg-|tap-target/;
const SKIP = /type="(checkbox|color|radio)"|<input|<kbd|<code|<pre|<Skeleton/;
const BARE = /(["'`\s])rounded(?=["'`\s])/g;

let lines = 0;
const files = new Set();
for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  const out = src.split('\n').map((ln) => {
    if (!CONTROL.test(ln) || SKIP.test(ln) || !BARE.test(ln)) return ln;
    BARE.lastIndex = 0;
    lines++;
    files.add(path.relative(SRC, file));
    return ln.replace(BARE, '$1rounded-md');
  });
  const next = out.join('\n');
  if (next !== src) fs.writeFileSync(file, next);
}

const chat = path.join(SRC, 'components/messaging/ChatWindow.tsx');
const c = fs.readFileSync(chat, 'utf8');
fs.writeFileSync(chat, c.replace('rounded-[1.35rem]', 'rounded-3xl'));

console.log(`${lines} lines in ${files.size} files`);
console.log([...files].join('\n'));
