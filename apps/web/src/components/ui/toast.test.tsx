import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguagePreferenceProvider } from '@/lib/i18n/LanguagePreferenceContext';
import { ToastProvider, useToast } from './toast';

let toast: ReturnType<typeof useToast>;
function Launcher() {
  toast = useToast();
  return <button>Outside</button>;
}

function setup() {
  return render(<StrictMode><LanguagePreferenceProvider><ToastProvider><Launcher /></ToastProvider></LanguagePreferenceProvider></StrictMode>);
}

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); });

describe('toast accessibility and dismissal', () => {
  it.each([
    ['success', 'status', 'polite'], ['info', 'status', 'polite'],
    ['warning', 'alert', 'assertive'], ['error', 'alert', 'assertive'],
  ] as const)('announces %s at the appropriate priority without decorative icons', (type, role, live) => {
    setup();
    act(() => { toast[type]('Notice', 'Details'); });
    const announcement = screen.getByRole(role);
    expect(announcement.getAttribute('aria-live')).toBe(live);
    expect(announcement.getAttribute('aria-atomic')).toBe('true');
    expect(announcement.textContent).toContain('Notice');
    expect(announcement.textContent).toContain('Details');
    const item = screen.getByText('Notice').closest('[data-toast]') ?? announcement.parentElement!;
    for (const icon of item.querySelectorAll('svg')) {
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it.each(['en', 'el'])('names the dismiss control bilingually with %s preference', (primary) => {
    localStorage.setItem('cfb:primary-language', primary);
    setup();
    act(() => { toast.success('Saved'); });
    const close = screen.getByRole('button', { name: /Dismiss notification.*Κλείσιμο ειδοποίησης|Κλείσιμο ειδοποίησης.*Dismiss notification/ });
    expect(close.getAttribute('aria-label')?.startsWith(primary === 'en' ? 'Dismiss notification' : 'Κλείσιμο ειδοποίησης')).toBe(true);
    fireEvent.click(close);
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('does not reset the first duration when another toast is added', () => {
    setup();
    act(() => { toast.info('First', undefined, { duration: 1000 }); });
    act(() => { vi.advanceTimersByTime(750); });
    act(() => { toast.info('Second', undefined, { duration: 1000 }); });
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.queryByText('First')).toBeNull();
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('pauses on hover and focus, resumes the remaining duration, and retains the action', () => {
    setup();
    const action = vi.fn();
    act(() => { toast.success('Saved', undefined, { duration: 1000, action: { label: 'Undo', onClick: action } }); });
    const undo = screen.getByRole('button', { name: 'Undo' });
    const item = undo.closest('[data-toast]') ?? undo.parentElement!.parentElement!;
    act(() => { vi.advanceTimersByTime(400); });
    fireEvent.mouseEnter(item);
    act(() => { undo.focus(); vi.advanceTimersByTime(5000); });
    expect(screen.getByText('Saved')).toBeTruthy();
    fireEvent.click(undo);
    expect(action).toHaveBeenCalledTimes(1);
    fireEvent.mouseLeave(item);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('Saved')).toBeTruthy();
    act(() => { screen.getByRole('button', { name: 'Outside' }).focus(); vi.advanceTimersByTime(599); });
    expect(screen.getByText('Saved')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('keeps duration zero notifications until explicitly dismissed', () => {
    setup();
    act(() => { toast.error('Persistent', undefined, { duration: 0 }); vi.advanceTimersByTime(60000); });
    expect(screen.getByText('Persistent')).toBeTruthy();
  });

  it('keeps action and dismiss controls outside the text live region', () => {
    setup();
    act(() => { toast.info('Saved', undefined, { action: { label: 'Undo', onClick: vi.fn() } }); });
    expect(within(screen.getByRole('status')).queryAllByRole('button')).toHaveLength(0);
  });
});
