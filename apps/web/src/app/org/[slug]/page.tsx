import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { OrgContent } from './OrgContent';
import { OrgProfileClient } from './OrgProfileClient';
import type { OrgProfile } from '@/lib/api';

export const revalidate = 60;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** The profile; null when the API says there is none; 'unreachable' when there was no answer. */
async function fetchOrg(slug: string): Promise<OrgProfile | null | 'unreachable'> {
  try {
    const res = await fetch(`${API_BASE}/api/org/${slug}`, {
      next: { revalidate: 60 },
    });
    if (res.status >= 500) return 'unreachable';
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.org ?? data?.org ?? null;
  } catch {
    return 'unreachable';
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const org = await fetchOrg(slug);
  if (org === 'unreachable') return { title: 'Organisation | CoFounderBay' };
  if (!org) return { title: 'Organization Not Found' };
  return {
    title: `${org.name} | CoFounderBay`,
    description: org.description ?? org.tagline ?? `${org.name} on CoFounderBay`,
    openGraph: {
      title: org.name,
      description: org.description ?? org.tagline ?? '',
      images: org.avatarUrl ? [{ url: org.avatarUrl }] : [],
    },
  };
}

export default async function OrgProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await fetchOrg(slug);
  if (org === 'unreachable') return <OrgProfileClient slug={slug} />;
  if (!org) notFound();

  return <OrgContent org={org} slug={slug} />;
}
