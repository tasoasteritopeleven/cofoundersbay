# Codemod: `{x.status.replace('_', ' ')}` rendered as JSX text becomes
# <StatusText value={x.status} /> (sentence case + Greek). Template strings
# (page-list rows for the assistant) are left alone - they are data, not UI.
import os
import re

PAT = re.compile(r"(?<![`$])\{([a-zA-Z_][a-zA-Z0-9_.?]*\.(?:status|role|stage|priority|type|state|severity))\.replace\((?:/_/g|'_'), ' '\)\}")
IMPORT = "import { StatusText } from '@/components/common/StatusText';\n"
os.chdir('src')
total = 0
for root in ['app', 'components']:
    for d, _, files in os.walk(root):
        for f in files:
            if not f.endswith('.tsx') or '.test.' in f:
                continue
            p = os.path.join(d, f)
            s = open(p, encoding='utf8').read()
            out, n = PAT.subn(lambda m: '<StatusText value={' + m.group(1) + '} />', s)
            if not n:
                continue
            # a `capitalize` utility around it is now redundant
            out = re.sub(r'className="capitalize">(<StatusText)', r'>\1', out)
            out = re.sub(r'<span className="capitalize">(<StatusText value=\{[^}]+\} />)</span>', r'\1', out)
            if 'components/common/StatusText' not in out:
                i = out.index('\nimport ') + 1
                out = out[:i] + IMPORT + out[i:]
            open(p, 'w', encoding='utf8').write(out)
            total += n
            print(p.replace(os.sep, '/'), n)
print('total', total)
