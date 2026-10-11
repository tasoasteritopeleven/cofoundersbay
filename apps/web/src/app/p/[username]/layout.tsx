import type { Metadata } from 'next';

const GENERIC = {
  title: 'A profile on CoFounderBay',
  description: 'Founders, mentors and investors building companies together.',
};

/**
 * What LinkedIn (or any link preview) shows for a shared public profile:
 * the person's name and headline, read from the same endpoint the page uses,
 * which already applies their visibility settings. Indexing stays as the
 * site's robots rules decide.
 */
export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  let title = GENERIC.title;
  let description = GENERIC.description;
  const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (api && username && /^[\w.-]{1,80}$/.test(username)) {
    try {
      const res = await fetch(`${api}/api/profiles/${encodeURIComponent(username)}`, { signal: AbortSignal.timeout(1500), next: { revalidate: 300 } });
      if (res.ok) {
        const body = (await res.json()) as { data?: { displayName?: string; headline?: string | null; bio?: string | null } };
        const p = body?.data;
        if (p?.displayName) title = `${p.displayName} · CoFounderBay`;
        if (p?.headline || p?.bio) description = (p.headline || p.bio || '').slice(0, 200);
      }
    } catch {
      // Unreachable or slow: the generic preview is still true.
    }
  }
  return {
    title,
    description,
    openGraph: { title, description, type: 'profile', siteName: 'CoFounderBay' },
    twitter: { card: 'summary', title, description },
  };
}

export default function PublicProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
