import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguagePreferenceProvider, useLanguagePreference } from './LanguagePreferenceContext';

let preference: ReturnType<typeof useLanguagePreference>;
function Probe() { preference = useLanguagePreference(); return null; }
function setup() { return render(<LanguagePreferenceProvider><Probe /></LanguagePreferenceProvider>); }

beforeEach(() => { localStorage.clear(); document.documentElement.lang = 'en'; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); document.documentElement.lang = 'en'; });

describe('document language preference', () => {
  it('restores Greek as the document language while retaining display attributes', () => {
    localStorage.setItem('cfb:primary-language', 'el');
    localStorage.setItem('cfb:language-display', 'primary-only');
    setup();
    expect(document.documentElement.lang).toBe('el');
    expect(document.documentElement.dataset.primaryLang).toBe('el');
    expect(document.documentElement.dataset.languageDisplay).toBe('primary-only');
  });

  it('updates document language when toggled without changing the language display mode', () => {
    setup();
    act(() => { preference.togglePrimary(); });
    expect(document.documentElement.lang).toBe('el');
    expect(preference.showSecondary).toBe(true);
    act(() => { preference.setPrimary('en'); });
    expect(document.documentElement.lang).toBe('en');
  });

  it('uses a safe default for corrupt or inaccessible storage', () => {
    localStorage.setItem('cfb:primary-language', 'unexpected');
    const view = setup();
    expect(document.documentElement.lang).toBe('en');
    view.unmount();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    setup();
    act(() => { preference.setPrimary('el'); });
    expect(document.documentElement.lang).toBe('el');
  });
});
