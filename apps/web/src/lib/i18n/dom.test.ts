import { afterEach, describe, expect, it } from 'vitest';
import { translateDom } from './dom';

/**
 * The DOM pass translates English copy in place for the locales the
 * components do not translate themselves. Two rules keep it from fighting
 * React, and both were hydration failures before they existed.
 */
const t = (source: string) => ({ Settings: 'Configuración', Save: 'Guardar', Overview: 'Επισκόπηση' } as Record<string, string>)[source] ?? source;

/** Stand-in for the expando React writes onto every element it has hydrated. */
function claim(el: Element) {
  (el as unknown as Record<string, unknown>)['__reactFiber$test'] = {};
}

afterEach(() => {
  document.body.innerHTML = '';
  delete (document.body as unknown as Record<string, unknown>)['__reactFiber$test'];
});

describe('translateDom', () => {
  it('translates everything on a plain DOM, as it always did', () => {
    document.body.innerHTML = '<p>Settings</p>';
    translateDom(document.body, t, false, true);
    expect(document.body.textContent).toBe('Configuración');
  });

  it('leaves server HTML React has not hydrated yet', () => {
    // React is running (body is claimed) but this page has not hydrated:
    // rewriting it would make React find different text than it rendered.
    claim(document.body);
    document.body.innerHTML = '<main><h1>Settings</h1></main>';
    translateDom(document.body, t, false, true);
    expect(document.querySelector('h1')!.textContent).toBe('Settings');

    // Once React claims it, the next pass translates it.
    claim(document.querySelector('main')!);
    claim(document.querySelector('h1')!);
    translateDom(document.body, t, false, true);
    expect(document.querySelector('h1')!.textContent).toBe('Configuración');
  });

  it('leaves the attributes of unhydrated HTML too', () => {
    // React compares aria-label and title during hydration as well.
    claim(document.body);
    document.body.innerHTML = '<button aria-label="Save">x</button>';
    translateDom(document.body, t, false, true);
    expect(document.querySelector('button')!.getAttribute('aria-label')).toBe('Save');
    claim(document.querySelector('button')!);
    translateDom(document.body, t, false, true);
    expect(document.querySelector('button')!.getAttribute('aria-label')).toBe('Guardar');
  });

  it('under Greek, leaves a pair that supplies its own Greek', () => {
    // BilingualText renders the Greek itself the moment the preference
    // applies; translating its English span first raced hydration.
    const greek = (source: string) => ({ Overview: 'Επισκόπηση', Save: 'Αποθήκευση' } as Record<string, string>)[source] ?? source;
    document.body.innerHTML =
      '<span lang="en" data-bilingual-pair="">Overview</span><span lang="en">Save</span>';
    translateDom(document.body, greek, false, false);
    const [pair, plain] = Array.from(document.querySelectorAll('span'));
    expect(pair.textContent).toBe('Overview');
    // No Greek half: the pass is still the only translation it gets.
    expect(plain.textContent).toBe('Αποθήκευση');
  });

  it('under a third locale, translates the pair as before', () => {
    // Spanish reads the English source translated; the Greek mark does not apply.
    document.body.innerHTML = '<span lang="en" data-bilingual-pair="">Settings</span>';
    translateDom(document.body, t, false, true);
    expect(document.querySelector('span')!.textContent).toBe('Configuración');
  });
});
