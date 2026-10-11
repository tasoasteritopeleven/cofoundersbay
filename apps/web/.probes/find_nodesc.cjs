const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'src');
function walk(d) {
  let o = [];
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) o = o.concat(walk(p));
    else if (/\.tsx$/.test(f.name)) o.push(p);
  }
  return o;
}
for (const f of walk(root)) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!/<(DialogTitle|SheetTitle|AlertDialogTitle)\b/.test(line)) return;
    let desc = false;
    for (let j = i; j < Math.min(i + 15, lines.length); j++) {
      if (/<(DialogDescription|SheetDescription|AlertDialogDescription)\b|aria-describedby/.test(lines[j])) { desc = true; break; }
      if (/<\/(DialogHeader|SheetHeader|AlertDialogHeader)>/.test(lines[j])) break;
    }
    if (!desc) {
      let und = false;
      for (let j = Math.max(0, i - 14); j < i; j++) if (/aria-describedby/.test(lines[j])) und = true;
      if (!und) console.log(f.split(path.sep).join('/') + ':' + (i + 1) + '  ' + line.trim().slice(0, 90));
    }
  });
}
