import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/verify-email',   // the route is /auth/verify-email, not /verify-email
  '/auth/oauth-callback',
  '/auth/sso-complete',
  '/demo',
  '/pricing',
  '/terms',
  '/privacy',
  '/transparency',
  '/help',
  '/demo',
  '/api-status',
  '/manifest.json',
  '/site.webmanifest',
  '/robots.txt',
  '/sitemap.xml',
]);

const PUBLIC_PREFIXES = [
  '/p/',         // public user profile pages /p/[username]
  '/c/',         // public need cards /c/[token], shared by their author
  '/pitch/',     // published pitch decks /pitch/[id]; unpublished ones answer "not found"
  '/u/',         // public founder updates /u/[token], shared by their author
  // Share links are for stakeholders without an account (ArtifactShareLink);
  // behind the sign-in redirect they could never be opened by them.
  '/share/',
  '/profiles/',
  '/t/',         // tenant public landing pages /t/[slug]
  '/themes/',    // static theme previews
  '/_next/',
  '/favicon',
  '/uploads/',
  '/api/',
];

/**
 * Routes that look public by prefix but must stay behind auth.
 * `/events/[id]` is a public listing; `/events/create` is not.
 */
const PROTECTED_EXCEPTIONS = ['/events/create'];

const STATIC_EXTENSIONS = /\.(ico|png|jpg|jpeg|svg|webp|css|js|json|webmanifest|txt|xml|woff2?|ttf|otf|map)$/;

function isPublicPath(pathname: string): boolean {
  if (PROTECTED_EXCEPTIONS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (STATIC_EXTENSIONS.test(pathname)) return true;
  // Individual event pages are public; the /events index still requires auth
  // via the general rule below.
  if (/^\/events\/[^/]+$/.test(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** The platform's own top-level domain (used for subdomain detection in prod) */
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'cofounderbay.com';

/**
 * Try to detect tenant slug from the request hostname.
 * - Subdomain pattern: athens.cofounderbay.com → slug "athens"
 * - Custom domain: founders.uni.edu → resolved via API
 * In dev (localhost / 127.0.0.1), no domain-based tenant is inferred.
 */
function extractTenantSlugFromHostname(hostname: string): string | null {
  if (!hostname) return null;
  // Strip port
  const host = hostname.split(':')[0];

  // Skip localhost / loopback
  if (host === 'localhost' || host === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null;
  }

  // Platform subdomain: athens.cofounderbay.com
  const subdomainPattern = new RegExp(`^([^.]+)\\.${PLATFORM_DOMAIN.replace('.', '\\.')}$`);
  const match = host.match(subdomainPattern);
  if (match) {
    const sub = match[1].toLowerCase();
    // Skip reserved subs
    if (!['www', 'app', 'api', 'admin', 'mail', 'cdn', 'static'].includes(sub)) {
      return sub;
    }
  }

  return null; // Custom domains resolved client-side via resolveTenantFromDomain()
}

function requestPublicOrigin(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '') ?? 'https';
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.host;
  return `${proto}://${host}`;
}

function isCloudflarePreviewHost(request: NextRequest): boolean {
  const host = (
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    ''
  )
    .split(':')[0]
    .toLowerCase();
  return host.endsWith('.trycloudflare.com');
}

function applyPreviewDemoCookies(response: NextResponse, secure: boolean) {
  const options = {
    path: '/',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
    secure,
  };
  response.cookies.set('cfb_session', 'preview-demo', options);
  response.cookies.set('cfb_preview_demo', '1', options);
  response.cookies.set('cfb_primary_role', 'existing_founder', options);
}

function isSafeInternalPath(value: string | null): value is string {
  return Boolean(value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/login') && !value.startsWith('/register'));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  const publicOrigin = requestPublicOrigin(request);
  const previewHost = isCloudflarePreviewHost(request);

  const response = NextResponse.next();

  // ── Domain-aware tenant injection ──────────────────────────────────────────
  const tenantSlug = extractTenantSlugFromHostname(hostname);
  if (tenantSlug) {
    response.headers.set('x-tenant-slug', tenantSlug);
    response.headers.set('x-tenant-hostname', hostname.split(':')[0]);
  }

  // Cloudflare Quick Tunnel previews have no reachable API, so keep a demo session
  // on every request. Otherwise cookie wipes / deep links bounce people to login.
  if (previewHost) {
    applyPreviewDemoCookies(response, publicOrigin.startsWith('https:'));
    if (pathname === '/login' || pathname === '/register') {
      const redirectTo = request.nextUrl.searchParams.get('redirect');
      const target = isSafeInternalPath(redirectTo) ? redirectTo : '/dashboard/founder';
      const bounce = NextResponse.redirect(new URL(target, publicOrigin));
      applyPreviewDemoCookies(bounce, publicOrigin.startsWith('https:'));
      return bounce;
    }
  }

  // ── Demo entry point ───────────────────────────────────────────────────────
  // Installing the demo session and redirecting happen together, in one response,
  // because both are things the *server* has to agree with: the auth guard below
  // reads these cookies, so the target must be requested with them already set.
  // Doing it from the client instead (the previous approach) meant an effect
  // racing the provider tree's hydration render churn — it lost, the redirect
  // never committed, and /demo sat on its loading screen re-rendering itself
  // while React reported "Maximum update depth exceeded". Cookies cannot be set
  // during a Server Component render in Next 15, so middleware is the right home
  // for this. The client-only half of the demo session (localStorage) is filled
  // in on arrival by PreviewSessionGuard in the root layout.
  if (pathname === '/demo') {
    const demoRedirect = NextResponse.redirect(new URL('/dashboard/founder', publicOrigin));
    applyPreviewDemoCookies(demoRedirect, publicOrigin.startsWith('https:'));
    return demoRedirect;
  }

  // Always allow public paths (after setting tenant headers)
  if (isPublicPath(pathname)) {
    return response;
  }

  // ── Auth guard ─────────────────────────────────────────────────────────────
  const hasSession =
    previewHost ||
    request.cookies.has('cfb_session') ||
    request.cookies.get('cfb_preview_demo')?.value === '1';
  if (!hasSession) {
    const loginUrl = new URL('/login', publicOrigin);
    loginUrl.searchParams.set('redirect', pathname);
    // Preserve tenant context through login redirect
    if (tenantSlug) loginUrl.searchParams.set('tenant', tenantSlug);
    return NextResponse.redirect(loginUrl);
  }

  // ── Dashboard role redirect (edge-level, eliminates client-side double-redirect) ──
  if (pathname === '/dashboard') {
    const primaryRole = request.cookies.get('cfb_primary_role')?.value;
    const ROLE_ROUTES: Record<string, string> = {
      aspiring_founder:    '/dashboard/founder',
      existing_founder:    '/dashboard/founder',
      cofounder_candidate: '/dashboard/founder',
      technical_talent:    '/dashboard/founder',
      business_operator:   '/dashboard/founder',
      mentor:              '/dashboard/mentor',
      advisor:             '/dashboard/mentor',
      coach:               '/dashboard/mentor',
      course_creator:      '/dashboard/mentor',
      angel_investor:      '/dashboard/investor',
      vc_scout:            '/dashboard/investor',
      vc_analyst:          '/dashboard/investor',
      syndicate_manager:   '/dashboard/investor',
      incubator_admin:     '/dashboard/incubator',
      accelerator_admin:   '/dashboard/incubator',
      university_admin:    '/dashboard/incubator',
      venture_studio_admin:'/dashboard/incubator',
      service_provider:    '/dashboard/provider',
      legal_partner:       '/dashboard/provider',
      finance_advisor:     '/dashboard/provider',
      recruiter:           '/dashboard/provider',
      platform_admin:      '/admin/dashboard',
    };
    const target = (primaryRole && ROLE_ROUTES[primaryRole]) || (previewHost ? '/dashboard/founder' : null);
    if (target) {
      const redirect = NextResponse.redirect(new URL(target, publicOrigin));
      if (previewHost) applyPreviewDemoCookies(redirect, publicOrigin.startsWith('https:'));
      return redirect;
    }
    // No role cookie yet → let the client DashboardRouter handle it
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
