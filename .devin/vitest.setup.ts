// jsdom does not implement window.matchMedia. Every browser this product
// targets has had it since 2013, so the production call sites in
// SidebarContext, RoleTheme, themes.ts, chart-theme.ts and animations.ts are
// correct to call it unguarded; the gap is the test environment, not the app.
//
// Width queries are evaluated against window.innerWidth (jsdom defaults to
// 1024) so breakpoint-dependent state such as SidebarContext's rail window is
// testable rather than permanently false. Feature queries such as
// prefers-color-scheme have no jsdom value and stay false, which is the same
// answer the previous absence produced.

type Listener = (event: MediaQueryListEvent) => void;

function evaluate(query: string): boolean {
  const width = window.innerWidth;
  let matched = false;

  for (const raw of query.split(/\s+and\s+/i)) {
    const feature = raw.trim().replace(/^\(|\)$/g, '');
    const [name, value] = feature.split(':').map((part) => part.trim());
    const px = value ? Number.parseFloat(value) : Number.NaN;

    if (name === 'min-width' && !Number.isNaN(px)) {
      if (width < px) return false;
      matched = true;
    } else if (name === 'max-width' && !Number.isNaN(px)) {
      if (width > px) return false;
      matched = true;
    }
  }

  return matched;
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => {
    const listeners = new Set<Listener>();
    const list = {
      media: query,
      get matches() {
        return evaluate(query);
      },
      onchange: null,
      addEventListener: (type: string, listener: Listener) => {
        if (type === 'change') listeners.add(listener);
      },
      removeEventListener: (type: string, listener: Listener) => {
        if (type === 'change') listeners.delete(listener);
      },
      // Deprecated Safari/legacy pair, still called by some libraries.
      addListener: (listener: Listener) => listeners.add(listener),
      removeListener: (listener: Listener) => listeners.delete(listener),
      dispatchEvent: (event: Event) => {
        listeners.forEach((listener) => listener(event as MediaQueryListEvent));
        return true;
      },
    };
    return list as unknown as MediaQueryList;
  };
}

// nwsapi 2.2.27 (jsdom's selector engine) answers `:modal` and `:fullscreen`
// by calling `element.matches` with the same pseudo-class again, which is
// nwsapi itself: the call recurses until the stack overflows, the innermost
// frame's catch returns false, and every frame on the way back starts another
// descent. floating-ui asks `matches(':modal')` of each ancestor while it
// positions a tooltip or popover, so one open tooltip cost seconds of CPU and
// the mobile drawer's tests (a mode tooltip opens on the focused button) ran
// past their 60s timeout. jsdom has no top layer and no Fullscreen API, so the
// answer nwsapi would reach is "is this the fullscreen element", which is
// never true here; that is returned without the descent. Every other selector
// still goes through nwsapi.
if (typeof Element !== 'undefined') {
  const matches = Element.prototype.matches;
  const topLayer = new Set([':modal', ':fullscreen']);
  Element.prototype.matches = function patchedMatches(this: Element, selectors: string) {
    if (typeof selectors === 'string' && topLayer.has(selectors.trim())) {
      return (this.ownerDocument as Document & { fullscreenElement?: Element | null }).fullscreenElement === this;
    }
    return matches.call(this, selectors);
  };
}
