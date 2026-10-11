"""
Static WCAG 1.4.3 check over the design tokens, for every theme.

Adopted from origin/claude/project-audit-upgrade-y2ebnr (2e5b104) and pointed
at this line's token names: --primary-accessible / --destructive-accessible
instead of --primary-emphasis / --destructive-emphasis.

The app ships light, dark, system, alliance, cofounder, minimal and four role palettes.
Role classes apply *alongside* light or dark. axe sees only one combination at
a time; this reads globals.css and checks every pair in every composed context.

Run: python3 scripts/check-theme-contrast.py   (exits non-zero on a failure)
"""

import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
css = open(os.path.join(ROOT, 'src/app/globals.css')).read()

def hsl_to_rgb(h, s, l):
    h, s, l = h / 360.0, s / 100.0, l / 100.0
    if s == 0:
        r = g = b = l
    else:
        def hue(p, q, t):
            t %= 1
            if t < 1 / 6:
                return p + (q - p) * 6 * t
            if t < 1 / 2:
                return q
            if t < 2 / 3:
                return p + (q - p) * (2 / 3 - t) * 6
            return p
        q = l * (1 + s) if l < 0.5 else l + s - l * s
        p = 2 * l - q
        r, g, b = hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)
    return (r, g, b)

def lum(rgb):
    def c(v):
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (c(x) for x in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

def hexs(rgb):
    return '#' + ''.join(f'{round(v * 255):02x}' for v in rgb)

blocks = {}
for m in re.finditer(
    # `html.dark.role-*` is how globals.css writes the dark role overrides
    # (the extra type selector outranks `.role-*`); read it as `.dark.role-*`.
    r'(?m)^\s*(?:html)?(:root|\.dark|\.dark\.role-[a-z]+|\.role-[a-z]+|\[data-theme="[a-z]+"\])\s*\{',
    css,
):
    name = m.group(1)
    i = m.end()
    depth = 1
    while i < len(css) and depth:
        if css[i] == '{':
            depth += 1
        elif css[i] == '}':
            depth -= 1
        i += 1
    body = css[m.end():i - 1]
    vars_ = {}
    for vm in re.finditer(r'--([\w-]+)\s*:\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%', body):
        vars_[vm.group(1)] = hsl_to_rgb(float(vm.group(2)), float(vm.group(3)), float(vm.group(4)))
    if vars_:
        blocks.setdefault(name, {}).update(vars_)

PAIRS = [
    ('foreground', 'background', 'body text on page'),
    ('card-foreground', 'card', 'text on card'),
    ('popover-foreground', 'popover', 'text in popover'),
    ('primary-foreground', 'primary', 'label on primary fill'),
    ('ink', 'status-success-mark', 'ink on success mark'),
    ('ink', 'status-warning-mark', 'ink on warning mark'),
    ('ink', 'status-danger-mark', 'ink on danger mark'),
    ('ink', 'status-info-mark', 'ink on info mark'),
    ('ink', 'status-accent-mark', 'ink on accent mark'),
    ('secondary-foreground', 'secondary', 'label on secondary button'),
    ('muted-foreground', 'muted', 'muted text on muted fill'),
    ('muted-foreground', 'background', 'muted text on page'),
    ('muted-foreground', 'card', 'muted text on card'),
    ('accent-foreground', 'accent', 'label on accent fill'),
    ('destructive-foreground', 'destructive', 'label on destructive button'),
    ('primary-accessible', 'background', 'primary link on page'),
    ('primary-accessible', 'card', 'primary link on card'),
    ('destructive-accessible', 'card', 'error text on card'),
]

AA_TEXT = 4.5
AA_LARGE = 3.0

print(f'{"theme":<26}{"pair":<34}{"ratio":>7}  verdict')
print('-' * 78)
fails = []
contexts = {}
for key in blocks:
    if key.startswith('.dark.role-'):
        continue
    if key.startswith('.role-'):
        light_merged = dict(blocks[':root'])
        light_merged.update(blocks[key])
        contexts[f'{key} + light'] = light_merged
        dark_role = blocks.get('.dark' + key, {})
        merged = dict(blocks[':root'])
        for layer in (blocks['.dark'], blocks[key], dark_role):
            merged.update(layer)
        contexts[f'{key} + dark'] = merged
    elif key == ':root':
        contexts[key] = blocks[key]
    else:
        m2 = dict(blocks[':root'])
        m2.update(blocks[key])
        contexts[key] = m2

def blend(fg_rgb, bg_rgb, alpha):
    return tuple(f * alpha + b * (1 - alpha) for f, b in zip(fg_rgb, bg_rgb))

# Text that sits on the accent's own faint tints. Tailwind draws bg-primary/N
# below 50% from --primary-mid (tailwind.config.ts), so an active chip,
# avatar or badge is primary-accessible on mid/10..20 over the page or a card,
# and helper text often sits on a /5 wash. 38 call sites use the /20 pair.
TINT_PAIRS = [
    ('primary-accessible', 0.10, 'accent text on accent tint /10'),
    ('primary-accessible', 0.20, 'accent text on accent tint /20'),
    ('muted-foreground', 0.05, 'helper text on accent wash /5'),
    ('muted-foreground', 0.10, 'helper text on accent tint /10'),
]

for key in contexts:
    v = contexts[key]
    tint = v.get('primary-mid') or v.get('primary')
    for fg, alpha, label in TINT_PAIRS:
        if fg not in v or tint is None:
            continue
        for base in ('background', 'card'):
            if base not in v:
                continue
            bg = blend(tint, v[base], alpha)
            r = ratio(v[fg], bg)
            if r < AA_TEXT:
                fails.append((key, f'{label} on {base}', round(r, 2), hexs(v[fg]), hexs(bg)))
            print(f'{key:<26}{(label + " on " + base)[:33]:<34}{r:>7.2f}  {"PASS" if r >= AA_TEXT else "** FAIL **"}')

for key in contexts:
    v = contexts[key]
    for fg, bg, label in PAIRS:
        if fg not in v or bg not in v:
            continue
        r = ratio(v[fg], v[bg])
        ok = r >= AA_TEXT
        mark = 'PASS' if ok else ('large-only' if r >= AA_LARGE else '** FAIL **')
        if not ok:
            fails.append((key, label, round(r, 2), hexs(v[fg]), hexs(v[bg])))
        print(f'{key:<26}{label:<34}{r:>7.2f}  {mark}')
    print()

print(f'\nTOTAL FAILURES BELOW 4.5:1 -> {len(fails)}')
for k, l, r, f, b in fails:
    print(f'  {k:<22} {l:<34} {r:>5}  fg {f} on bg {b}')

sys.exit(1 if fails else 0)
