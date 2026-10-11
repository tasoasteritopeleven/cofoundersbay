const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'CODE',
  'PRE',
  'KBD',
  'TEXTAREA',
  'SVG',
  'PATH',
  'MATH',
]);

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'label'] as const;

const originalText = new WeakMap<Text, string>();
const lastText = new WeakMap<Text, string>();
const originalAttr = new WeakMap<Element, Record<string, string>>();
const lastAttr = new WeakMap<Element, Record<string, string>>();

let applying = false;

function shouldSkipElement(el: Element | null): boolean {
  while (el) {
    const tag = el.tagName;
    if (SKIP_TAGS.has(tag)) return true;
    if ((el as HTMLElement).isContentEditable) return true;
    // The second language of a BilingualText pair is shown on purpose; under the
    // Greek locale the pass would turn its English into a copy of the Greek beside it.
    if (el.classList.contains('bilingual-secondary')) return true;
    el = el.parentElement;
  }
  return false;
}

export function shouldTranslateSource(value: string): boolean {
  const text = value.trim();
  if (text.length < 2) return false;
  if (!/[A-Za-z\u00C0-\u024F]/.test(text)) return false;
  if (/^[A-Z]{1,3}$/.test(text)) return false;
  if (text.includes('@') && text.includes('.') && !text.includes(' ')) return false;
  if (/^https?:\/\//i.test(text) || text.startsWith('mailto:') || (text.startsWith('/') && !text.includes(' ')))
    return false;
  if (/^[\d%$€£.,+\-↑↓/\s]+$/.test(text)) return false;
  // Lowercase words and tags ("pinned", "market-analysis") are copy; ids and keys carry a digit or underscore.
  if (/^[a-z0-9_-]+$/.test(text) && /[\d_]/.test(text)) return false;
  if (/^(flex|grid|inline-|bg-|text-|border-|h-|w-|p-|m-|gap-|sm:|lg:|md:|hover:|dark:)/.test(text) && /[-:]/.test(text))
    return false;
  if (text.startsWith('data:')) return false;
  return true;
}

function resolveSource(current: string, original: string | undefined, last: string | undefined): string {
  if (original === undefined) return current;
  if (current === last || current === original) return original;
  return current;
}

const GREEK = /[\u0370-\u03FF\u1F00-\u1FFF]/;

/**
 * `bilingualAria` and `bilingualInline` join both languages ("Overview.
 * Επισκόπηση"). Under a third locale that put Greek into Spanish tooltips and
 * screen-reader names; keep the English parts, translated, and drop the rest.
 */
function withoutGreek(text: string, t: (source: string) => string): string {
  if (!GREEK.test(text)) return t(text);
  // A question keeps its mark: "Why this match? Γιατί ταιριάζετε;" joins without a full stop.
  const parts = text.split(/(?<=[.?!…])\s+|\s·\s/).map((part) => part.trim()).filter(Boolean);
  const kept = parts.filter((part) => !GREEK.test(part));
  if (!kept.length) return text;
  return kept.map((part) => t(part.replace(/\.$/, ''))).join('. ');
}

function translateValue(source: string, t: (source: string) => string, monolingual: boolean): string {
  const trimmed = source.trim();
  // Under Greek, text that already carries Greek is a pair or Greek copy. Run
  // through a pattern such as "Open {label}", the whole pair became the label.
  if (!monolingual && GREEK.test(trimmed)) return source;
  const next = monolingual ? withoutGreek(trimmed, t) : t(trimmed);
  return next === trimmed ? source : source.replace(trimmed, next);
}

/**
 * Whether React has claimed this element yet.
 *
 * Next 15 streams a page and hydrates it in pieces: the root layout first, a
 * page that suspends (on `useSearchParams`, async params, data) later. DomI18n
 * lives in the layout, so it starts translating while a suspended page is
 * still the server's HTML — and rewriting text React has not hydrated makes
 * React find "Configuración" where it rendered "Settings". It reports a
 * hydration failure and re-renders the whole tree on the client. Measured on
 * /settings under Spanish; the other six pages checked did not suspend.
 *
 * React writes a `__reactFiber$<id>` expando onto every element it hydrates or
 * creates. An element without one, in a document where React is running, is
 * server HTML that is not React's yet — and not ours to touch until it is.
 * This is an internal key, stable since React 17 and read by DevTools and
 * testing tools alike; if it ever changed, `reactIsRunning` turns false and
 * the pass falls back to translating everything, as it did before.
 */
function hasFiber(el: Element): boolean {
  for (const key in el) {
    if (key.startsWith('__reactFiber$')) return true;
  }
  return false;
}

function reactIsRunning(): boolean {
  // <body> is rendered by the root layout, so it carries a fiber as soon as
  // React has hydrated anything at all. A plain DOM (tests, a static page)
  // has none, and keeps the old translate-everything behaviour.
  return typeof document !== 'undefined' && !!document.body && hasFiber(document.body);
}

export function translateDom(
  root: ParentNode,
  t: (source: string) => string,
  passthrough: boolean,
  /** A locale that reads in one language: drop the Greek half of bilingual strings. */
  monolingual = false,
): void {
  if (applying) return;
  applying = true;
  try {
    const guardHydration = reactIsRunning();
    const claimed = new WeakMap<Element, boolean>();
    const isClaimed = (el: Element) => {
      let hit = claimed.get(el);
      if (hit === undefined) {
        hit = hasFiber(el);
        claimed.set(el, hit);
      }
      return hit;
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const textNode = node as Text;
      node = walker.nextNode();
      const parent = textNode.parentElement;
      if (!parent || shouldSkipElement(parent)) continue;
      if (guardHydration && !isClaimed(parent)) continue;
      // Under Greek a BilingualText that carries its own Greek is React's to
      // render, not ours to rewrite — see `pairMark` in BilingualText.
      if (!monolingual && !passthrough && parent.closest('[data-bilingual-pair]')) continue;
      const current = textNode.nodeValue ?? '';
      if (!current.trim()) continue;
      const source = resolveSource(current, originalText.get(textNode), lastText.get(textNode));
      originalText.set(textNode, source);
      const next = passthrough || !shouldTranslateSource(source) ? source : translateValue(source, t, monolingual);
      lastText.set(textNode, next);
      if (textNode.nodeValue !== next) textNode.nodeValue = next;
    }

    const attrTargets = root.querySelectorAll(
      '[placeholder],[title],[aria-label],[alt],[label]',
    );
    const extra: Element[] = root instanceof Element ? [root] : [];
    for (const el of [...extra, ...attrTargets]) {
      // A textarea's value is the user's own text, but its placeholder is ours.
      if (shouldSkipElement(el.tagName === 'TEXTAREA' ? el.parentElement : el)) continue;
      // Attributes race hydration exactly as text does: React compares
      // aria-label and title too ("Ask AI" vs "Preguntar a la IA").
      if (guardHydration && !isClaimed(el)) continue;
      const orig = originalAttr.get(el) ?? {};
      const last = lastAttr.get(el) ?? {};
      let changedOrig = false;
      let changedLast = false;
      for (const key of ATTRS) {
        const current = el.getAttribute(key);
        if (current == null || !current.trim()) continue;
        const source = resolveSource(current, orig[key], last[key]);
        if (orig[key] !== source) {
          orig[key] = source;
          changedOrig = true;
        }
        const next =
          passthrough || !shouldTranslateSource(source) ? source : translateValue(source, t, monolingual);
        if (last[key] !== next) {
          last[key] = next;
          changedLast = true;
        }
        if (current !== next) el.setAttribute(key, next);
      }
      if (changedOrig) originalAttr.set(el, orig);
      if (changedLast) lastAttr.set(el, last);
    }
  } finally {
    applying = false;
  }
}
