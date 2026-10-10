'use client';

import { useEffect } from 'react';

const CAP = 'maximum-scale=1';

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports a Mac; a touch screen tells them apart.
  return /iP(hone|od|ad)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function capped(content: string): string {
  const parts = content
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !/^maximum-scale\s*=/i.test(part));
  return [...parts, CAP].join(', ');
}

/**
 * iOS zooms the whole page into a focused field set under 16px, and fields
 * here sit a notch under their labels (14.406px on a phone). On iOS only,
 * the viewport gains maximum-scale=1, which stops that focus zoom; iOS has
 * ignored the cap for pinch zoom since iOS 10, so people can still zoom to
 * any size. Every other platform keeps the server's viewport (maximum-scale
 * 5), because Android would honour the cap and lose pinch zoom (WCAG 1.4.4).
 */
export function IosFieldZoom() {
  useEffect(() => {
    if (!isIos()) return;
    const apply = () => {
      const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
      if (!meta) return;
      const next = capped(meta.content);
      if (meta.content !== next) meta.content = next;
    };
    apply();
    // A navigation can re-render the head; keep the cap on the new tag.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, attributes: true, attributeFilter: ['content'] });
    return () => observer.disconnect();
  }, []);
  return null;
}
