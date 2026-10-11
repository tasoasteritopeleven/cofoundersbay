# Codemod: a raw API enum rendered as text in role pages ("active",
# "in_review", "high") goes through StatusText, which gives it sentence case
# and its Greek. DNS record types (TXT/CNAME) are not enums and are skipped.
import os
import re

FIELDS = 'status|type|programType|severity|priority|role|category|level|stage|state'
PAT = re.compile(r'>(\s*)\{([a-zA-Z_][a-zA-Z0-9_.?]*\.(?:' + FIELDS + r'))\}(\s*)<')
SKIP = {'admin/domains/page.tsx', 'tenant/domains/page.tsx'}
IMPORT = "import { StatusText } from '@/components/common/StatusText';\n"

os.chdir('src/app')
total = 0
for root in ['admin', 'org', 'investor', 'mentor', 'provider', 'tenant']:
    for d, _, files in os.walk(root):
        for f in files:
            if not f.endswith('.tsx') or '.test.' in f:
                continue
            p = os.path.join(d, f).replace(os.sep, '/')
            if p in SKIP:
                continue
            s = open(p, encoding='utf8').read()
            n = len(PAT.findall(s))
            if not n:
                continue
            s = PAT.sub(lambda m: '>' + m.group(1) + '<StatusText value={' + m.group(2) + '} />' + m.group(3) + '<', s)
            if 'components/common/StatusText' not in s:
                i = s.index('\nimport ') + 1
                s = s[:i] + IMPORT + s[i:]
            open(p, 'w', encoding='utf8').write(s)
            total += n
            print(p, n)
print('total', total)
