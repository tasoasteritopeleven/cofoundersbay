'use client';

import { useEffect } from 'react';
import { choosePhonePlaceholder, splitBilingualPlaceholder, type PhonePrimary } from '@/lib/phone-placeholder';

const PHONE = '(max-width: 639.98px)';
const STORED = 'data-bilingual-placeholder';

function readPrimary(): PhonePrimary {
  try {
    return localStorage.getItem('cfb:primary-language') === 'el' ? 'el' : 'en';
  } catch {
    return 'en';
  }
}

function textWidth(sample: string, source: HTMLElement): number {
  const probe = document.createElement('span');
  const style = getComputedStyle(source);
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${style.font};letter-spacing:${style.letterSpacing};`;
  probe.textContent = sample;
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

function availableWidth(el: HTMLInputElement | HTMLTextAreaElement): number {
  const style = getComputedStyle(el);
  return el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
}

function sourceText(el: HTMLInputElement | HTMLTextAreaElement): string | null {
  const current = el.placeholder ?? '';
  if (splitBilingualPlaceholder(current)) {
    if (el.getAttribute(STORED) !== current) el.setAttribute(STORED, current);
    return current;
  }
  return el.getAttribute(STORED);
}

function apply(root: ParentNode) {
  const phone = window.matchMedia(PHONE).matches;
  const primary = readPrimary();
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[placeholder], textarea[placeholder], input[data-bilingual-placeholder], textarea[data-bilingual-placeholder]').forEach((el) => {
    const full = sourceText(el);
    if (!full) return;
    const next = choosePhonePlaceholder(full, phone, primary, textWidth(full, el), availableWidth(el));
    if (el.placeholder !== next) el.placeholder = next;
  });
}

/**
 * Phone fields keep one language in the placeholder when the bilingual pair
 * does not fit. Tablet and desktop placeholders are restored in full.
 * Runs after paint, so the server HTML is unchanged.
 */
export function PhonePlaceholderFit() {
  useEffect(() => {
    let frame = 0;
    const observe: MutationObserverInit = {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['placeholder'],
    };
    const observer = new MutationObserver(() => schedule());
    const run = () => {
      observer.disconnect();
      try {
        apply(document.body);
      } finally {
        observer.observe(document.body, observe);
      }
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        run();
      });
    };
    schedule();
    const media = window.matchMedia(PHONE);
    media.addEventListener('change', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      media.removeEventListener('change', schedule);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, []);
  return null;
}
