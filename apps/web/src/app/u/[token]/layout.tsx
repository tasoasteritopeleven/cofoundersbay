import type { Metadata } from 'next';

const GENERIC = {
  title: 'A founder update on CoFounderBay',
  description: 'What moved, a few figures, and what would help — shared by the founder.',
};

/**
 * What LinkedIn (or any link preview) shows for a shared founder update:
 * its title and the first lines, read from the API with a short timeout.
 * Never indexed: a founder shares it on purpose.
 */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  let title = GENERIC.title;
  let description = GENERIC.description;
  const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (api && token && /^[\w-]{8,80}$/.test(token)) {
    try {
      const res = await fetch(`${api}/api/updates/public/${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(1500), next: { revalidate: 300 } });
      if (res.ok) {
        const body = (await res.json()) as { data?: { update?: { title?: string; body?: string; author?: { displayName?: string } } } };
        const u = body?.data?.update;
        if (u?.title) title = `${u.title} · ${u.author?.displayName ?? 'CoFounderBay'}`;
        if (u?.body) description = u.body.slice(0, 200);
      }
    } catch {
      // Unreachable or slow: the generic preview is still true.
    }
  }
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'article', siteName: 'CoFounderBay' },
    twitter: { card: 'summary', title, description },
  };
}

export default function PublicUpdateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
