import type { AnchorHTMLAttributes } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileNav } from './MobileNav';
import { MobileBottomNav } from './MobileBottomNav';
import { SidebarProvider } from './SidebarContext';
import { getSectionsForMode, type SidebarMode } from './nav-modes';
import { getNavLabelEl, getNavSectionEl } from '@/lib/i18n/strings-nav';
import { LanguagePreferenceProvider } from '@/lib/i18n/LanguagePreferenceContext';

const state = vi.hoisted(() => ({ pathname: '/dashboard/founder', role: 'founder' as string | undefined, messages: 3, intros: 2, notifications: 4, prefetch: vi.fn() }));

vi.mock('next/navigation', () => ({ usePathname: () => state.pathname, useRouter: () => ({ prefetch: state.prefetch }) }));
vi.mock('next/link', () => ({
  default: ({ href, prefetch, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => (
    <a {...props} href={href} onClick={(event) => { onClick?.(event); event.preventDefault(); }} />
  ),
}));
vi.mock('@/hooks/useStoredUser', () => ({ useStoredUser: () => state.role ? { displayName: 'Alex Demo', role: state.role, email: 'alex@example.com' } : null }));
vi.mock('@/hooks/useUnreadCounts', () => ({ useUnreadCounts: () => ({ messages: state.messages, intros: state.intros, notifications: state.notifications }) }));

function Navigation() {
  return <LanguagePreferenceProvider><SidebarProvider><MobileNav /><MobileBottomNav /></SidebarProvider></LanguagePreferenceProvider>;
}

function openDrawer() {
  const trigger = screen.getByRole('button', { name: /Open navigation/ });
  trigger.focus();
  fireEvent.click(trigger);
  return screen.getByRole('dialog');
}

beforeEach(() => {
  localStorage.clear();
  state.pathname = '/dashboard/founder';
  state.role = 'founder';
});
afterEach(cleanup);

describe('Mobile navigation destinations', () => {
  it.each(['founder', 'mentor', 'investor', 'service_provider', 'org', 'admin', 'tenant_admin'])('preserves every existing destination and translation for %s across all modes', (role) => {
    state.role = role;
    render(<Navigation />);
    const drawer = openDrawer();
    for (const mode of ['work', 'explore', 'account'] as SidebarMode[]) {
      fireEvent.click(within(drawer).getByRole('button', { name: new RegExp(`^${mode === 'work' ? 'Work' : mode === 'explore' ? 'Explore' : 'Account'}`) }));
      const navigation = within(drawer).getByRole('navigation');
      for (const section of getSectionsForMode(mode, role)) {
        expect(navigation.textContent).toContain(getNavSectionEl(section.section) ?? section.section);
        for (const link of section.links) {
          const anchor = Array.from(navigation.querySelectorAll('a')).find((element) => element.getAttribute('href') === link.href);
          expect(anchor, link.href).toBeDefined();
          expect(anchor!.textContent).toContain(link.label);
          const greek = getNavLabelEl(link.href);
          if (greek) expect(anchor!.textContent).toContain(greek);
        }
      }
    }
  });

  it('marks only the most specific destination as current', () => {
    state.pathname = '/builder/pitch-deck';
    render(<Navigation />);
    const navigation = within(openDrawer()).getByRole('navigation');
    const current = navigation.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].getAttribute('href')).toBe('/builder/pitch-deck');
  });

  it('does not mark similarly prefixed routes as current', () => {
    state.pathname = '/builder-extra';
    render(<Navigation />);
    expect(within(openDrawer()).getByRole('navigation').querySelector('[aria-current="page"]')).toBeNull();
  });

  it('closes when the already-current destination is selected', async () => {
    render(<Navigation />);
    const navigation = within(openDrawer()).getByRole('navigation');
    fireEvent.click(navigation.querySelector('a[href="/dashboard/founder"]')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('does not close for modifier-click navigation', () => {
    render(<Navigation />);
    const navigation = within(openDrawer()).getByRole('navigation');
    fireEvent.click(navigation.querySelector('a[href="/dashboard/founder"]')!, { ctrlKey: true });
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('retains both sign-in and sign-up as single interactive links for guests', () => {
    state.role = undefined;
    render(<Navigation />);
    const drawer = openDrawer();
    for (const href of ['/login', '/register']) {
      const link = drawer.querySelector(`a[href="${href}"]`)!;
      expect(link).not.toBeNull();
      expect(link.querySelector('button')).toBeNull();
      expect(link.querySelector('[lang="el"]')).not.toBeNull();
    }
  });
});

describe('Mobile drawer keyboard and language', () => {
  it('opens from More and returns focus there after Escape', async () => {
    render(<Navigation />);
    const more = screen.getByRole('button', { name: /More destinations/ });
    more.focus();
    fireEvent.click(more);
    const drawer = screen.getByRole('dialog');
    expect(more.getAttribute('aria-controls')).toBe(drawer.id);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(drawer, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(more));
  });

  it('closes on pathname changes', async () => {
    const view = render(<Navigation />);
    openDrawer();
    state.pathname = '/discover';
    view.rerender(<Navigation />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows both languages on all five bottom destinations', () => {
    render(<Navigation />);
    const bar = screen.getByRole('navigation', { name: /Primary mobile navigation/ });
    const actions = [...within(bar).getAllByRole('link'), within(bar).getByRole('button')];
    expect(actions).toHaveLength(5);
    actions.forEach((action) => {
      expect(action.querySelector('[lang="en"]')).not.toBeNull();
      expect(action.querySelector('[lang="el"]')).not.toBeNull();
    });
  });

  it('honors Greek-first preference while preserving English labels', () => {
    localStorage.setItem('cfb:primary-language', 'el');
    render(<Navigation />);
    const bar = screen.getByRole('navigation', { name: /Primary mobile navigation/ });
    const profile = bar.querySelector('a[href="/profile"]')!;
    expect(profile.querySelector('[lang]')?.getAttribute('lang')).toBe('el');
    expect(profile.textContent).toContain('Profile');
  });

  it('exposes notification counts in account mode', () => {
    localStorage.setItem('cfb:sidebar-mode', 'account');
    render(<Navigation />);
    const navigation = within(openDrawer()).getByRole('navigation');
    expect(navigation.querySelector('a[href="/notifications"]')?.textContent).toContain('4');
  });

  it.each(['/login', '/register', '/auth/oauth-callback', '/onboarding'])('hides the bottom bar on %s', (pathname) => {
    state.pathname = pathname;
    render(<Navigation />);
    expect(screen.queryByRole('navigation', { name: /Primary mobile navigation/ })).toBeNull();
  });
});
