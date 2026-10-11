'use client';

import { useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';

/**
 * Suggested LinkedIn post text for what a member shares from CoFounderBay.
 *
 * LinkedIn's official share link (`/sharing/share-offsite/?url=`) takes a
 * URL and nothing else: it builds the preview from the page's Open Graph
 * tags. So the text is suggested, not injected: the share action copies it
 * to the clipboard and the member pastes it into their post, or does not.
 * Every text is built from content that already passed the platform's
 * contact and promise rules, plus the public link; nothing is added that
 * the member did not write, and nothing promises an outcome.
 */

type Lang = 'en' | 'el';
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function needCardPost(card: { title: string; missing: string; exists?: string }, url: string, lang: Lang): string {
  return lang === 'el'
    ? [`Ψάχνουμε: ${clip(card.missing, 220)}`, card.exists ? clip(card.exists, 200) : '', `Η κάρτα και ο τρόπος να απαντήσετε, στο CoFounderBay: ${url}`].filter(Boolean).join('\n\n')
    : [`We are looking for: ${clip(card.missing, 220)}`, card.exists ? clip(card.exists, 200) : '', `The card, and how to answer, on CoFounderBay: ${url}`].filter(Boolean).join('\n\n');
}

export function founderUpdatePost(update: { title: string }, url: string, lang: Lang): string {
  return lang === 'el' ? `${clip(update.title, 160)}\n\nΗ ενημέρωσή μας, στο CoFounderBay: ${url}` : `${clip(update.title, 160)}\n\nOur update, on CoFounderBay: ${url}`;
}

export function pitchPost(pitch: { title: string }, url: string, lang: Lang): string {
  return lang === 'el' ? `${clip(pitch.title, 160)}: η παρουσίασή μας, στο CoFounderBay.\n\n${url}` : `${clip(pitch.title, 160)}: our pitch, on CoFounderBay.\n\n${url}`;
}

export function profilePost(url: string, lang: Lang): string {
  return lang === 'el' ? `Το προφίλ μου στο CoFounderBay, με όσα χτίζω και ψάχνω: ${url}` : `My profile on CoFounderBay, with what I am building and looking for: ${url}`;
}

/**
 * The share click: copy the suggested text, say so, and let the link open
 * LinkedIn as before. The copy failing never blocks the share.
 */
export function useSuggestedPost() {
  const { success } = useToast();
  const { primary } = useLanguagePreference();
  const lang: Lang = primary === 'el' ? 'el' : 'en';
  const copy = useCallback(
    (text: string) => {
      void navigator.clipboard
        ?.writeText(text)
        .then(() => success('Suggested post copied', 'Paste it into your LinkedIn post; LinkedIn shows the preview from the link.'))
        .catch(() => undefined);
    },
    [success],
  );
  return { lang, copy };
}
