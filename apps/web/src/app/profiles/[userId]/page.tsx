import { Metadata } from 'next';
import PublicProfilePage from './ProfileContent';

export const revalidate = 60;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function fetchPublicProfile(userId: string) {
  try {
    const res = await fetch(`${API_URL}/api/profiles/${userId}/public`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const profile = await fetchPublicProfile(userId);
  if (!profile) {
    return { title: 'Profile | CoFounderBay', description: 'View this profile on CoFounderBay' };
  }
  // `??` guarded the headline but not the role, so a payload without one put the
  // literal word into the description: "undefined on CoFounderBay", in the meta
  // tag and the OpenGraph card that link previews read.
  const summary =
    profile.headline ??
    (profile.role ? `${profile.role} on CoFounderBay` : 'View this profile on CoFounderBay');

  return {
    title: `${profile.displayName ?? 'Profile'} | CoFounderBay`,
    description: summary,
    openGraph: {
      title: `${profile.displayName ?? 'Profile'} on CoFounderBay`,
      description: summary,
      images: profile.avatarUrl ? [{ url: profile.avatarUrl }] : [],
    },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <PublicProfilePage userId={userId} />;
}
