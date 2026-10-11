import type { Metadata } from 'next';

const GENERIC = {
  title: 'A pitch on CoFounderBay',
  description: 'A founder’s pitch deck, published by its owner.',
};

/**
 * What LinkedIn (or any link preview) shows for a published pitch: company
 * and tagline from `/api/pitch/:id/public`. Unpublished decks answer 404 and
 * keep the generic preview. Never indexed.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  let title = GENERIC.title;
  let description = GENERIC.description;
  const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (api && id && /^[\w-]{1,80}$/.test(id)) {
    try {
      const res = await fetch(`${api}/api/pitch/${encodeURIComponent(id)}/public`, { signal: AbortSignal.timeout(1500), next: { revalidate: 300 } });
      if (res.ok) {
        const body = (await res.json()) as { data?: { deck?: { companyName?: string; title?: string; tagline?: string } } };
        const deck = body?.data?.deck;
        if (deck?.companyName) title = `${deck.companyName} · ${deck.title ?? 'Pitch'}`;
        if (deck?.tagline) description = deck.tagline;
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

export default function PublicPitchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
