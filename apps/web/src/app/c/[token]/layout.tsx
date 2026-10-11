import type { Metadata } from 'next';

const GENERIC = {
  title: 'A need card on CoFounderBay',
  description: 'A founder shared a structured need: what already exists, the outcome, who is missing and what is offered.',
};

/**
 * What LinkedIn (or any link preview) shows for a shared need card.
 *
 * The card is read from the API by its token when the API is reachable from
 * the server, with a short timeout; otherwise the preview is generic. The
 * page is never indexed - a person shares it on purpose, a search engine
 * does not need it - which does not stop a preview from reading these tags.
 */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  let title = GENERIC.title;
  let description = GENERIC.description;
  const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (api && token && /^[\w-]{8,80}$/.test(token)) {
    try {
      const res = await fetch(`${api}/api/commitments/public/${encodeURIComponent(token)}`, {
        signal: AbortSignal.timeout(1500),
        next: { revalidate: 300 },
      });
      if (res.ok) {
        const body = (await res.json()) as { data?: { card?: { title?: string; missing?: string; offer?: { role?: string } } } };
        const card = body?.data?.card;
        if (card?.title) title = `${card.title} · CoFounderBay`;
        if (card?.missing) description = [card.missing, card.offer?.role].filter(Boolean).join(' — ');
      }
    } catch {
      // Unreachable or slow: the generic preview is still true.
    }
  }
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website', siteName: 'CoFounderBay' },
    twitter: { card: 'summary', title, description },
  };
}

export default function PublicCardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
