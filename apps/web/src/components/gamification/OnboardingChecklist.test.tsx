import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildOnboardingSteps,
  OnboardingChecklist,
  useOnboardingChecklistDismissed,
} from './OnboardingChecklist';

const storageKey = 'cfb_onboarding_dismissed_v1';
const steps = buildOnboardingSteps({
  hasProfile: false,
  hasPreferences: false,
  hasConnection: false,
  hasBoard: false,
  hasArtifact: false,
});

function DashboardObserver() {
  const dismissed = useOnboardingChecklistDismissed();
  return <output data-testid="dismissed">{String(dismissed)}</output>;
}

function renderDashboard() {
  return render(
    <>
      <DashboardObserver />
      <OnboardingChecklist steps={steps} />
    </>,
  );
}

function storageEvent(key: string | null, newValue: string | null, storageArea?: Storage) {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea }));
  });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  storageEvent(null, null);
  cleanup();
  localStorage.clear();
});

describe('OnboardingChecklist', () => {
  it('immediately notifies a separate dashboard observer when dismissed', () => {
    renderDashboard();

    expect(screen.getByTestId('dismissed').textContent).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /Dismiss the getting-started checklist/ }));

    expect(screen.getByTestId('dismissed').textContent).toBe('true');
    expect(screen.queryByRole('button', { name: /Your founder journey/ })).toBeNull();
    expect(localStorage.getItem(storageKey)).toBe('true');
  });

  it('reads an existing persisted dismissal', () => {
    localStorage.setItem(storageKey, 'true');
    renderDashboard();

    expect(screen.getByTestId('dismissed').textContent).toBe('true');
    expect(screen.queryByRole('button', { name: /Your founder journey/ })).toBeNull();
  });

  it('still dismisses and notifies observers when storage reads and writes throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError');
    });
    const view = renderDashboard();

    expect(screen.getByTestId('dismissed').textContent).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /Dismiss the getting-started checklist/ }));

    expect(screen.getByTestId('dismissed').textContent).toBe('true');
    expect(screen.queryByRole('button', { name: /Your founder journey/ })).toBeNull();
    view.unmount();
    renderDashboard();
    expect(screen.getByTestId('dismissed').textContent).toBe('true');
    expect(screen.queryByRole('button', { name: /Your founder journey/ })).toBeNull();
  });

  it('retains dismissal for newly mounted observers when only storage writes fail', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });
    const view = renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /Dismiss the getting-started checklist/ }));

    expect(screen.getByTestId('dismissed').textContent).toBe('true');
    view.unmount();
    renderDashboard();
    expect(screen.getByTestId('dismissed').textContent).toBe('true');
    expect(screen.queryByRole('button', { name: /Your founder journey/ })).toBeNull();
  });

  it('works when accessing localStorage itself throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    });
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /Dismiss the getting-started checklist/ }));

    expect(screen.getByTestId('dismissed').textContent).toBe('true');
    expect(screen.queryByRole('button', { name: /Your founder journey/ })).toBeNull();
  });

  it('synchronizes cross-tab dismissal, removal, and clear events', () => {
    renderDashboard();
    storageEvent(storageKey, 'true', localStorage);
    expect(screen.getByTestId('dismissed').textContent).toBe('true');
    expect(screen.queryByRole('button', { name: /Your founder journey/ })).toBeNull();

    storageEvent(storageKey, null, localStorage);
    expect(screen.getByTestId('dismissed').textContent).toBe('false');
    expect(screen.getByRole('button', { name: /Your founder journey/ })).not.toBeNull();

    storageEvent(storageKey, 'true', localStorage);
    storageEvent(null, null, localStorage);
    expect(screen.getByTestId('dismissed').textContent).toBe('false');
    expect(screen.getByRole('button', { name: /Your founder journey/ })).not.toBeNull();
  });

  it('ignores unrelated keys and session storage events', () => {
    renderDashboard();
    storageEvent('unrelated', 'true', localStorage);
    storageEvent(storageKey, 'true', sessionStorage);

    expect(screen.getByTestId('dismissed').textContent).toBe('false');
    expect(screen.getByRole('button', { name: /Your founder journey/ })).not.toBeNull();
  });

  it('keeps the aria-controls target mounted and hidden when collapsed', () => {
    render(<OnboardingChecklist steps={steps} />);
    const toggle = screen.getByRole('button', { name: /Your founder journey/ });
    const targetId = toggle.getAttribute('aria-controls');
    expect(targetId).not.toBeNull();
    fireEvent.click(toggle);

    const content = document.getElementById(targetId!);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(content).not.toBeNull();
    expect(content?.hidden).toBe(true);
    expect(screen.queryAllByRole('link')).toHaveLength(0);

    fireEvent.click(toggle);
    expect(content?.hidden).toBe(false);
    expect(screen.getAllByRole('link')).toHaveLength(5);
  });

  it('auto-collapses by default but preserves an explicit expanded choice as progress changes', () => {
    const partialSteps = steps.map((step, index) => ({ ...step, done: index < 3 }));
    const view = render(<OnboardingChecklist steps={partialSteps} />);
    const toggle = screen.getByRole('button', { name: /Your founder journey/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    view.rerender(<OnboardingChecklist steps={steps.map((step, index) => ({ ...step, done: index < 4 }))} />);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('supports disabling automatic collapse', () => {
    render(<OnboardingChecklist autoCollapse={false} steps={steps.map((step, index) => ({ ...step, done: index < 4 }))} />);
    expect(screen.getByRole('button', { name: /Your founder journey/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('renders nothing for empty steps and can subsequently render valid progress', () => {
    const view = render(<OnboardingChecklist steps={[]} />);
    expect(view.container.innerHTML).toBe('');

    view.rerender(<OnboardingChecklist steps={steps} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-label')).toContain('Getting started: 0% complete');
    expect(view.container.innerHTML).not.toContain('NaN');
  });

  it('hides upon completion without marking the checklist dismissed', () => {
    const view = renderDashboard();
    view.rerender(
      <>
        <DashboardObserver />
        <OnboardingChecklist steps={steps.map((step) => ({ ...step, done: true }))} />
      </>,
    );

    expect(screen.queryByRole('button', { name: /Your founder journey/ })).toBeNull();
    expect(screen.getByTestId('dismissed').textContent).toBe('false');
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it('preserves every bilingual step and CTA as a single link without a nested button', () => {
    render(<OnboardingChecklist steps={steps} />);

    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/profile', '/profile#preferences', '/discover', '/research', '/builder',
    ]);
    for (const step of steps) {
      expect(screen.getByText(step.label)).not.toBeNull();
      expect(screen.getByText(step.labelEl!)).not.toBeNull();
      expect(screen.getByText(step.description)).not.toBeNull();
      expect(screen.getByText(step.descriptionEl!)).not.toBeNull();
      const link = screen.getByRole('link', { name: new RegExp(step.cta) });
      expect(link.textContent).toContain(step.ctaEl);
      expect(link.querySelector('button')).toBeNull();
    }
  });
});
