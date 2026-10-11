/**
 * Links for a need card that leave the app: its public page, and the
 * LinkedIn share of that page.
 *
 * Only the public card is shared - never the board, which needs an account -
 * and the LinkedIn link carries nothing but that URL, so no email, phone or
 * profile id travels with it.
 */
export function publicCardUrl(token: string, origin = typeof window !== 'undefined' ? window.location.origin : ''): string {
  return `${origin}/c/${encodeURIComponent(token)}`;
}

export function linkedInShareUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

/** Sign-up that comes back to the card's board once the account exists. */
export function joinToRespondHref(cardId: string): string {
  return `/register?redirect=${encodeURIComponent(`/commitments/${cardId}`)}`;
}

export function signInToRespondHref(cardId: string): string {
  return `/login?redirect=${encodeURIComponent(`/commitments/${cardId}`)}`;
}
