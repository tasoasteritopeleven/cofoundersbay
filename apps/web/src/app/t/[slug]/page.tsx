'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getTenantBySlug, discoverSSOByTenant, getSSOLoginUrl, type TenantItem, type SSODiscoveryResult } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Briefcase,
  ChevronRight,
  Globe,
  Mail,
  ExternalLink,
  Sparkles,
  Shield,
  Linkedin,
  Twitter,
  Instagram,
  Building2,
  LogIn,
} from 'lucide-react';
import Link from 'next/link';
import { qk } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';
import { StatusText } from '@/components/common/StatusText';
import { bilingualAria } from '@/lib/i18n/format';
import { MainLandmark } from '@/components/layout/AppShell';

function hexToHsl(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function TenantLanding({ tenant, sso, slug }: { tenant: TenantItem; sso: SSODiscoveryResult | null; slug: string }) {
  const b = tenant.branding;
  // One name for the page. A tenant row missing both fields rendered an empty
  // hero heading and "Ready to join undefined?"; the slug is the name the
  // visitor typed to get here.
  const tenantName = tenant.displayName || tenant.name || tenant.slug || slug;

  const cssVars: React.CSSProperties & Record<`--${string}`, string> = {} as React.CSSProperties &
    Record<`--${string}`, string>;
  if (b?.primaryColor) {
    const h = hexToHsl(b.primaryColor);
    if (h) {
      cssVars['--primary'] = h;
      cssVars['--primary-foreground'] = '0 0% 100%';
    }
  }
  if (b?.secondaryColor) {
    const h = hexToHsl(b.secondaryColor);
    if (h) cssVars['--secondary'] = h;
  }
  if (b?.accentColor) {
    const h = hexToHsl(b.accentColor);
    if (h) cssVars['--accent'] = h;
  }

  const handleSSOLogin = () => {
    if (!sso?.provider?.id) return;
    window.location.href = getSSOLoginUrl(sso.provider.id, `/t/${tenant.slug}`);
  };

  return (
    <div className="min-h-screen bg-background" style={cssVars}>
      <MainLandmark>
      {/* Hero */}
      <section
        className="relative overflow-hidden text-white"
        style={b?.heroImageUrl
          ? { backgroundImage: `url(${b.heroImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : undefined}
      >
        {/* Overlay — always present so text is readable over both gradient and photo heroes */}
        <div
          className="absolute inset-0"
          style={b?.heroImageUrl
            ? { background: 'linear-gradient(to bottom right, rgba(0,0,0,0.65), rgba(0,0,0,0.45))' }
            : { background: 'linear-gradient(to bottom right, var(--tw-gradient-from, oklch(0.6 0.2 264)), var(--tw-gradient-to, oklch(0.45 0.2 264)))' }}
        />
        {/* Subtle light burst */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_50%,white_0%,transparent_60%)]" />

        <div className="relative mx-auto max-w-5xl px-6 py-24 text-center">
          {tenant.logoUrl && (
            <img src={tenant.logoUrl} alt={tenant.name} className="mx-auto mb-6 h-16 w-auto rounded-xl shadow-lg" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          )}
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl mb-4 drop-shadow">
            {b?.heroTitle || tenantName}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-white/80 mb-8 drop-shadow-sm">
            {b?.heroSubtitle || tenant.shortDescription || tenant.description || <BilingualText en="Join our startup ecosystem" el="Μπείτε στο οικοσύστημά μας" wrap secondaryClassName="text-white/75" />}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* SSO login button (shown first if SSO available) */}
            {sso?.ssoAvailable && sso.provider && (
              <Button
                size="lg"
                onClick={handleSSOLogin}
                className="gap-2 bg-white/10 border border-white/30 text-white hover:bg-white/20 backdrop-blur-sm"
              >
                <Building2 className="icon-sm" />
                {sso.provider?.loginButtonText || <BilingualText en="Sign in with Organization SSO" el="Σύνδεση με SSO οργανισμού" compact secondaryClassName="text-white/75" />}
              </Button>
            )}

            <Button size="lg" className="bg-white text-foreground hover:bg-white/90 gap-2 shadow" asChild>
              <Link href={b?.ctaUrl || '/register'}>
                {b?.ctaLabel || <BilingualText en="Get Started" el="Ξεκινήστε" compact />}
                <ChevronRight className="icon-sm" />
              </Link>
            </Button>

            <Button size="lg" variant="ghost" className="border border-white/30 text-white hover:bg-white/10 gap-2" asChild>
              <Link href="/login">
                <LogIn className="icon-sm" />
                <BilingualText en="Sign In" el="Σύνδεση" compact secondaryClassName="text-white/75" />
              </Link>
            </Button>
          </div>

          {sso?.ssoRequired && (
            <p className="mt-4 text-xs text-white/75"><BilingualText en="This organization requires SSO authentication for member access." el="Αυτός ο οργανισμός απαιτεί σύνδεση SSO για πρόσβαση μελών." wrap secondaryClassName="text-white/75" /></p>
          )}
        </div>
      </section>

      {/* About section — shown only when aboutText is set */}
      {(b?.aboutText || tenant.aboutText) && (
        <section className="bg-muted/30 border-b border-border">
          <div className="mx-auto max-w-4xl px-6 py-14">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted mt-1">
                <Building2 className="icon-md text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-3"><BilingualText en={`About ${tenantName}`} el={`Σχετικά με ${tenantName}`} wrap /></h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground sm:text-lg">
                  {b?.aboutText || tenant.aboutText}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Feature cards */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { icon: Users, title: b?.communityNaming ? `Join the ${b.communityNaming}` : 'Connect', titleEl: b?.communityNaming ? `Μπείτε στην κοινότητα ${b.communityNaming}` : 'Συνδεθείτε', desc: 'Find co-founders, mentors, and collaborators', descEl: 'Βρείτε συνιδρυτές, μέντορες και συνεργάτες' },
            { icon: Sparkles, title: 'AI Matching', titleEl: 'Αντιστοίχιση με AI', desc: 'Smart compatibility scoring for better teams', descEl: 'Έξυπνη βαθμολόγηση συμβατότητας για καλύτερες ομάδες' },
            { icon: Shield, title: 'Trusted Network', titleEl: 'Αξιόπιστο δίκτυο', desc: 'Verified profiles and moderated community', descEl: 'Επαληθευμένα προφίλ και κοινότητα με εποπτεία' },
          ].map((f) => (
            <Card key={f.title} className="border-border hover:border-primary/30 transition-colors">
              <CardContent>
                {/* Left-aligned like every card: the mark, then the title and
                    its sentence on the mark's edge. */}
                <div data-keep-icon="" className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <f.icon className="icon-md text-primary-accessible" />
                </div>
                <h3 className="card-title text-foreground"><BilingualText en={f.title} el={f.titleEl} wrap /></h3>
                <p className="card-body mt-1 text-muted-foreground"><BilingualText en={f.desc} el={f.descEl} wrap /></p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <Card className="bg-primary/5 border-primary/15">
          <CardContent>
            <h2 className="card-title mb-1">
              {b?.dashboardWelcomeText || <BilingualText en={`Ready to join ${tenantName}?`} el={`Έτοιμοι να μπείτε στο ${tenantName};`} wrap />}
            </h2>
            <p className="card-body text-muted-foreground mb-4">
              <BilingualText en="Connect with the right people and build something great." el="Συνδεθείτε με τους σωστούς ανθρώπους και φτιάξτε κάτι σπουδαίο." wrap />
            </p>
            <div className="flex flex-wrap gap-3">
              {sso?.ssoAvailable && sso.provider && (
                <Button onClick={handleSSOLogin} variant="outline" className="gap-2">
                  <Building2 className="icon-sm" />
                  {sso.provider?.loginButtonText || <BilingualText en="SSO Login" el="Σύνδεση SSO" compact />}
                </Button>
              )}
              {/* Default size: a large button's label outranked the card's
                  own title. */}
              <Button className="gap-2" asChild>
                <Link href={b?.ctaUrl || '/register'}>
                  {b?.ctaLabel || <BilingualText en="Join Now" el="Εγγραφή τώρα" compact />}
                  <ChevronRight className="icon-sm" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
      </MainLandmark>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            {tenant.logoUrl
              ? <img src={tenant.logoUrl} alt="" className="h-6 w-auto" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              : <Badge variant="secondary" className="text-xs"><StatusText value={tenant.status} /></Badge>}
            <span className="text-sm font-medium">{tenantName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {b?.supportEmail && (
              <a href={`mailto:${b.supportEmail}`} aria-label={bilingualAria('Email support', 'Email υποστήριξης')} className="text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="icon-sm" />
              </a>
            )}
            {(b?.websiteUrl || tenant.website) && (
              <a href={b?.websiteUrl || tenant.website!} target="_blank" rel="noopener noreferrer" aria-label={tenantName + ' website'} className="text-muted-foreground hover:text-foreground transition-colors">
                <Globe className="icon-sm" aria-hidden="true" />
              </a>
            )}
            {b?.linkedinUrl && (
              <a href={b.linkedinUrl} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-muted-foreground hover:text-foreground transition-colors">
                <Linkedin className="icon-sm" />
              </a>
            )}
            {b?.twitterUrl && (
              <a href={b.twitterUrl} target="_blank" rel="noopener noreferrer" aria-label="X / Twitter" className="text-muted-foreground hover:text-foreground transition-colors">
                <Twitter className="icon-sm" />
              </a>
            )}
            {b?.instagramUrl && (
              <a href={b.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-muted-foreground hover:text-foreground transition-colors">
                <Instagram className="icon-sm" />
              </a>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {b?.privacyPolicyUrl && (
                <a href={b.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground flex items-center gap-1">
                  <BilingualText en="Privacy" el="Απόρρητο" compact /> <ExternalLink className="icon-sm" />
                </a>
              )}
              {b?.termsUrl && (
                <a href={b.termsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground flex items-center gap-1">
                  <BilingualText en="Terms" el="Όροι" compact /> <ExternalLink className="icon-sm" />
                </a>
              )}
              {b?.cookiePolicyUrl && (
                <a href={b.cookiePolicyUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground flex items-center gap-1">
                  <BilingualText en="Cookies" el="Cookies" compact /> <ExternalLink className="icon-sm" />
                </a>
              )}
            </div>
          </div>
        </div>
        {b?.emailFooterText && (
          <div className="border-t border-border mx-auto max-w-5xl px-6 py-3">
            <p className="text-xs text-muted-foreground text-center">{b.emailFooterText}</p>
          </div>
        )}
      </footer>
    </div>
  );
}

export default function TenantPage() {
  const params = useParams();
  const slug = (params?.slug as string) ?? '';

  const { data: tenant, isLoading, isError } = useQuery({
    queryKey: qk('tenant', slug),
    queryFn: () => getTenantBySlug(slug),
    staleTime: 5 * 60_000,
  });

  const { data: sso } = useQuery({
    queryKey: qk('tenant', slug, 'sso'),
    queryFn: () => discoverSSOByTenant(slug),
    enabled: !!tenant,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-[50vh] bg-muted animate-pulse" />
        <div className="mx-auto max-w-5xl px-6 py-12 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !tenant) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center px-6">
        <Building2 className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground"><BilingualText en="Organization not found" el="Ο οργανισμός δεν βρέθηκε" compact /></h1>
        <p className="max-w-sm text-sm text-muted-foreground"><BilingualText en="The ecosystem you&apos;re looking for doesn&apos;t exist or is not active." el="Το οικοσύστημα που ψάχνετε δεν υπάρχει ή δεν είναι ενεργό." wrap /></p>
        <Button variant="outline" asChild>
          <Link href="/"><BilingualText en="Back to CoFounderBay" el="Επιστροφή στο CoFounderBay" compact /></Link>
        </Button>
      </div>
    );
  }

  return <TenantLanding tenant={tenant} sso={sso ?? null} slug={slug} />;
}
