import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchTenantMeta(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/api/tenants/by-slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 }, // 5-minute cache
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
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await fetchTenantMeta(slug);

  if (!tenant) {
    return {
      title: 'Organization Not Found | CoFounderBay',
      description: 'This organization does not exist or is no longer active.',
    };
  }

  const b = tenant.branding;
  const name = tenant.displayName ?? tenant.name;
  const description =
    b?.heroSubtitle ??
    tenant.shortDescription ??
    `Join ${name} on CoFounderBay — connect with founders, mentors, and investors.`;

  return {
    title: `${name} | CoFounderBay`,
    description,
    openGraph: {
      title: b?.heroTitle ?? name,
      description,
      type: 'website',
      ...(tenant.logoUrl ? { images: [{ url: tenant.logoUrl, alt: name }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: b?.heroTitle ?? name,
      description,
      ...(tenant.logoUrl ? { images: [tenant.logoUrl] } : {}),
    },
    ...(tenant.faviconUrl ? { icons: { icon: tenant.faviconUrl } } : {}),
    alternates: {
      canonical: `/t/${slug}`,
    },
  };
}

export default function TenantLandingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
