import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStoredUser } from '@/hooks/useStoredUser';
import { LanguagePreferenceProvider } from '@/lib/i18n/LanguagePreferenceContext';
import { UserMenu } from './UserMenu';

const { push, clearPreviewDemoSession, setCommandOpen } = vi.hoisted(() => ({
  push: vi.fn(),
  clearPreviewDemoSession: vi.fn(),
  setCommandOpen: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/hooks/useStoredUser', () => ({ useStoredUser: vi.fn() }));
vi.mock('@/lib/preview-demo', () => ({ clearPreviewDemoSession }));
vi.mock('./CommandPaletteHost', () => ({ useOpenCommandPalette: () => setCommandOpen }));

const user = {
  displayName: 'Alex Example',
  email: 'alex@example.com',
  role: 'founder',
};

const labels = [
  { en: 'My Profile', el: 'Το προφίλ μου', href: '/profile' },
  { en: 'Edit Profile', el: 'Επεξεργασία προφίλ', href: '/profile/edit' },
  { en: 'Settings', el: 'Ρυθμίσεις', href: '/settings' },
];

/**
 * Radix opens the menu synchronously on the trigger's keydown, so this resolves
 * with a sync query. That keeps a failed assertion pointed at its real subject
 * instead of surfacing as a timeout, which is reason enough on its own.
 *
 * It is not, however, a performance measure. This comment used to claim that
 * `findBy*`/`waitFor` cost ~20s per call here because no setupFiles registered
 * RTL's auto-cleanup. Measured against this same config, a `waitFor` that
 * passes on its first check costs 4-19ms, whether the assertion is trivial or
 * queries a rendered node -- the retry loop is not what makes this file slow.
 * The cost is in mounting and opening the Radix menu under jsdom, which the
 * sync-query choice does not change. Do not cite the old number when deciding
 * whether async queries are affordable elsewhere.
 */
function openMenu(key = 'ArrowDown') {
  const trigger = screen.getByRole('button');
  trigger.focus();
  fireEvent.keyDown(trigger, { key });
  return screen.getByRole('menu');
}

/**
 * Radix's DropdownMenu positions its content with Popper and drives the trigger
 * through the Pointer Capture API. jsdom implements neither, so without these
 * shims `findByRole('menu')` never resolves and every menu assertion times out
 * rather than failing on its actual subject. Dialog-based suites (confirm-dialog)
 * don't need this — they render inline instead of through Popper.
 */
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useStoredUser).mockReturnValue(user);
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.primaryLang;
  delete document.documentElement.dataset.languageDisplay;
  document.documentElement.lang = 'en';
});

describe('UserMenu', () => {
  it('explicitly names the account trigger in both languages without adding identity data', () => {
    render(<UserMenu />);
    const trigger = screen.getByRole('button', {
      name: 'Account menu for Alex Example. Μενού λογαριασμού για Alex Example',
    });
    expect(trigger.getAttribute('aria-label')).not.toContain(user.email);
    expect(trigger.className).toContain('rounded-xl');
    expect(trigger.className).toContain('focus-visible:outline-none');
    expect(trigger.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses the existing email as an accessible identity fallback', () => {
    vi.mocked(useStoredUser).mockReturnValue({ email: user.email });
    render(<UserMenu />);
    expect(screen.getByRole('button', {
      name: `Account menu for ${user.email}. Μενού λογαριασμού για ${user.email}`,
    })).toBeTruthy();
  });

  it('provides account and user fallback labels without inventing an identity', async () => {
    vi.mocked(useStoredUser).mockReturnValue(null);
    render(<UserMenu />);
    const trigger = screen.getByRole('button', { name: 'Account menu. Μενού λογαριασμού' });
    // The visible trigger label is single-language (primary first): two
    // stacked languages in a w-fixed rail is what produced the truncated
    // "Acc…". The bilingual pair lives in the aria-label above instead.
    expect(within(trigger).getByText('Account')).toBeTruthy();
    expect(within(trigger).queryByText('Λογαριασμός')).toBeNull();
    const menu = await openMenu();
    expect(within(menu).getByText('User')).toBeTruthy();
    expect(within(menu).getByText('Χρήστης')).toBeTruthy();
  });

  it.each(labels)('retains the $href destination with visible EN/EL labels and hidden decorative icons', async ({ en, el, href }) => {
    render(<UserMenu />);
    const menu = await openMenu();
    const item = within(menu).getByRole('menuitem', { name: new RegExp(en) });
    expect(item.getAttribute('href')).toBe(href);
    expect(within(item).getByText(en).getAttribute('lang')).toBe('en');
    const secondary = within(item).getByText(el);
    expect(secondary.getAttribute('lang')).toBe('el');
    // `.bilingual-secondary` owns the size (max(11px, 0.85em)) so the second
    // language stays subordinate without dropping below the legibility floor.
    // Asserting a fixed `text-sm` here would lock it to the primary's size.
    expect(secondary.className).toContain('bilingual-secondary');
    expect(secondary.className).toContain('whitespace-normal');
    expect(item.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows a bilingual signout action with a decorative icon', async () => {
    render(<UserMenu />);
    const menu = await openMenu();
    const item = within(menu).getByRole('menuitem', { name: /Sign out/ });
    expect(within(item).getByText('Αποσύνδεση').getAttribute('lang')).toBe('el');
    expect(item.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  // Radix restores focus and unmounts the menu across a frame, so these two need
  // the real async helpers. Budgeted generously: see the note on `openMenu` for
  // why a `waitFor` costs ~20s here.
  it('opens with ArrowDown and Escape closes and restores trigger focus', async () => {
    render(<UserMenu />);
    const trigger = screen.getByRole('button');
    const menu = openMenu('ArrowDown');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(within(menu).getAllByRole('menuitem').length).toBeGreaterThan(0));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(clearPreviewDemoSession).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  }, 240_000);

  it('opens with Enter and Escape closes and restores trigger focus', async () => {
    render(<UserMenu />);
    const trigger = screen.getByRole('button');
    const menu = openMenu('Enter');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(within(menu).getAllByRole('menuitem')[0]).toBe(document.activeElement));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(clearPreviewDemoSession).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  }, 120_000);

  it.each(['click', 'Enter'])('signout via %s clears the same session once then navigates to /login once', async (activation) => {
    render(<UserMenu />);
    const menu = await openMenu();
    const item = within(menu).getByRole('menuitem', { name: /Sign out/ });
    if (activation === 'click') {
      fireEvent.click(item);
    } else {
      item.focus();
      fireEvent.keyDown(item, { key: 'Enter' });
    }
    expect(clearPreviewDemoSession).toHaveBeenCalledTimes(1);
    expect(clearPreviewDemoSession).toHaveBeenCalledWith();
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/login');
    expect(clearPreviewDemoSession.mock.invocationCallOrder[0]).toBeLessThan(push.mock.invocationCallOrder[0]);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  }, 120_000);

  it('wraps long header names and emails at readable sizes and preserves the stored role', async () => {
    const displayName = 'Alexandros'.repeat(12);
    const email = `${'longemail'.repeat(12)}@example.com`;
    vi.mocked(useStoredUser).mockReturnValue({ ...user, displayName, email, role: 'custom-role' });
    render(<UserMenu />);
    const menu = await openMenu();
    for (const text of [displayName, email]) {
      const line = within(menu).getByText(text);
      expect(line.className).toContain('break-words');
      expect(line.className).toContain('whitespace-normal');
      expect(line.className).toContain('text-sm');
      expect(line.className).not.toContain('truncate');
      expect(line.className).not.toContain('leading-none');
    }
    expect(within(menu).getByText('custom-role').className).toContain('text-sm');
  });

  it('uses the real language preference API for Greek-first bilingual labels', async () => {
    localStorage.setItem('cfb:primary-language', 'el');
    render(<LanguagePreferenceProvider><UserMenu /></LanguagePreferenceProvider>);
    const menu = await openMenu();
    const item = within(menu).getByRole('menuitem', { name: /Το προφίλ μου.*My Profile/ });
    expect(item.querySelector('[lang]')?.getAttribute('lang')).toBe('el');
  });

  it('respects primary-only visible labels while keeping the explicit bilingual trigger name', async () => {
    localStorage.setItem('cfb:primary-language', 'el');
    localStorage.setItem('cfb:language-display', 'primary-only');
    render(<LanguagePreferenceProvider><UserMenu /></LanguagePreferenceProvider>);
    expect(screen.getByRole('button', { name: /Account menu.*Μενού λογαριασμού/ })).toBeTruthy();
    const menu = await openMenu();
    expect(within(menu).getByRole('menuitem', { name: 'Το προφίλ μου' }).getAttribute('href')).toBe('/profile');
    expect(within(menu).queryByText('My Profile')).toBeNull();
  });

  it('keeps command palette, language, and theme in the account menu', async () => {
    render(<LanguagePreferenceProvider><UserMenu /></LanguagePreferenceProvider>);
    const menu = await openMenu();
    expect(within(menu).getByRole('menuitem', { name: /Command palette|Παλέτα εντολών/ })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: /Language|Γλώσσα/ })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: /Theme|Θέμα/ })).toBeTruthy();
    expect(within(menu).getByText('Παλέτα εντολών').getAttribute('lang')).toBe('el');
    expect(within(menu).getByText('Γλώσσα').getAttribute('lang')).toBe('el');
    expect(within(menu).getByText('Θέμα').getAttribute('lang')).toBe('el');
  });

  it('opens the command palette from the account menu', async () => {
    render(<LanguagePreferenceProvider><UserMenu /></LanguagePreferenceProvider>);
    const menu = await openMenu();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Command palette|Παλέτα εντολών/ }));
    expect(setCommandOpen).toHaveBeenCalledWith(true);
  });
});
