import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { useScrollToHash } from './useScrollToHash';

/**
 * `/settings#verification` opened at the top of Settings: the card mounts
 * after load, after the browser's own fragment scroll has given up.
 */

function Page({ delay }: { delay: number }) {
  useScrollToHash(2000);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return ready ? <section id="verification">Verification</section> : <p>Loading</p>;
}

const scrolled: string[] = [];

beforeEach(() => {
  scrolled.length = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
    scrolled.push(this.id);
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

describe('useScrollToHash', () => {
  it('scrolls to a section that mounts after the page loaded', async () => {
    window.history.replaceState(null, '', '/settings#verification');
    render(<Page delay={500} />);
    expect(scrolled).toEqual([]);
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    // React commits the section when the first act ends; the hook is still looking.
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(scrolled[0]).toBe('verification');
  });

  it('does nothing without a hash', async () => {
    window.history.replaceState(null, '', '/settings');
    render(<Page delay={50} />);
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(scrolled).toEqual([]);
  });

  it('gives up when the section never appears', async () => {
    window.history.replaceState(null, '', '/settings#nowhere');
    render(<Page delay={50} />);
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(scrolled).toEqual([]);
  });
});
