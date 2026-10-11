import type { NextConfig } from 'next';

const allowedDevOrigins = ['localhost', '127.0.0.1', '*.trycloudflare.com', '*.replit.dev'];

const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@cofounderbay/shared'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins,
  devIndicators: false,
  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
    reactRemoveProperties: process.env.NODE_ENV === 'production',
  },
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 3600,
    // SVGs are allowed but are served with `script-src 'none'; sandbox` (below)
    // and as attachments, so they cannot execute in the page's origin.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.cloudfront.net' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'platform-lookaside.fbsbx.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  
  // Experimental features for better performance
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-select',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-accordion',
      'date-fns',
      'socket.io-client',
      '@tanstack/react-query',
    ],
    scrollRestoration: true,
    // Next.js 15 router cache: cache dynamic segments for 30s to speed up back/forward navigation
    staleTimes: {
      dynamic: 120,
      static: 600,
    },
  },

  // Turbopack is the dev compiler (enabled via `next dev --turbopack` in scripts/dev.js).
  // Declaring the key keeps Turbopack/webpack config resolution explicit. The webpack()
  // hook below still runs for `next build` (production), which uses webpack.
  turbopack: {},

  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    const target = (process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
    return [
      { source: '/api/:path*', destination: `${target}/api/:path*` },
      { source: '/socket.io/:path*', destination: `${target}/socket.io/:path*` },
    ];
  },

  // Production-only webpack tuning (dev uses Turbopack — omit webpack hook to avoid Next warning).
  ...(isProduction
    ? {
        webpack: (config: import('webpack').Configuration, { isServer }: { isServer: boolean }) => {
          if (!isServer) {
            config.optimization = {
              ...config.optimization,
              splitChunks: {
                ...(config.optimization?.splitChunks as object),
                cacheGroups: {
                  ...((config.optimization?.splitChunks as { cacheGroups?: Record<string, unknown> })?.cacheGroups ?? {}),
                  radix: {
                    test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
                    name: 'radix-ui',
                    chunks: 'all',
                    priority: 20,
                  },
                  charts: {
                    test: /[\\/]node_modules[\\/]recharts[\\/]/,
                    name: 'recharts',
                    chunks: 'all',
                    priority: 20,
                  },
                  motion: {
                    test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
                    name: 'framer-motion',
                    chunks: 'all',
                    priority: 20,
                  },
                },
              },
            };
          }
          return config;
        },
      }
    : {}),

  poweredByHeader: false,
  
  // Compression
  compress: true,
  
  // Headers for caching and security
  async headers() {
    const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

    // The API lives on a different origin, so it must be named in connect-src
    // or every request the app makes is blocked by the browser — silently, from
    // the server's point of view. Fail loudly at build time instead.
    // Adopted from origin/claude/project-audit-upgrade-y2ebnr (6a9e740, 87d78b7).
    if (isProduction && !apiOrigin) {
      console.warn(
        '\n[next.config] NEXT_PUBLIC_API_URL is not set for this production build.\n' +
          '  The Content-Security-Policy will only allow same-origin requests, so every\n' +
          '  call to the API will be blocked in the browser. Set it before deploying.\n',
      );
    }

    // Each entry is dropped when empty, so an unset origin cannot leave a
    // stray token (or a double space) inside the directive.
    const connectSrc = [
      "'self'",
      apiOrigin,
      apiOrigin.replace(/^http/, 'ws'),
      'https://*.posthog.com',
      'https://*.sentry.io',
      'wss:',
      // Local dev talks to the API and the websocket over plain http on
      // another port; without these `next dev` blocks its own requests.
      ...(isProduction ? [] : ['http://localhost:*', 'ws://localhost:*', 'http://127.0.0.1:*', 'ws://127.0.0.1:*']),
    ].filter(Boolean);

    // `unsafe-inline` is required for styles because the theme system writes
    // inline custom properties; `unsafe-eval` is only allowed in development,
    // where React Refresh needs it.
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"} https://*.posthog.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src ${connectSrc.join(' ')}`,
      "media-src 'self' blob: https:",
      "worker-src 'self' blob:",
      // Daily.co rooms are iframed, and the research canvas plus the PDF
      // annotation viewer iframe arbitrary document URLs — including blob:
      // object URLs — so this cannot be narrowed to named hosts without
      // breaking those surfaces. http: is required for user-supplied links.
      "frame-src 'self' https: http: blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      // Only in production: on a plain-http local worker run this would upgrade
      // same-origin navigations to https and break them.
      ...(isProduction && process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://')
        ? ['upgrade-insecure-requests']
        : []),
    ].join('; ');

    const headers = [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            // X-XSS-Protection is deprecated and its filter has itself been a
            // source of vulnerabilities; 0 disables it. CSP replaces it.
            key: 'X-XSS-Protection',
            value: '0'
          },
          {
            // strict-origin-when-cross-origin over origin-when-cross-origin:
            // the latter still sends the origin to http:// targets.
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: csp
          },
          {
            // Deny by default. camera/microphone stay available to same-origin
            // because the video-call surface requests them at the element level.
            key: 'Permissions-Policy',
            value: 'accelerometer=(), autoplay=(self), camera=(self), display-capture=(self), encrypted-media=(), geolocation=(), gyroscope=(), interest-cohort=(), magnetometer=(), microphone=(self), payment=(), usb=()'
          },
          {
            // allow-popups so OAuth sign-in windows still work.
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups'
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin'
          },
          {
            key: 'X-Permitted-Cross-Domain-Policies',
            value: 'none'
          }
        ]
      },
    ];

    if (isProduction) {
      headers.push(
        {
          source: '/static/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable'
            }
          ]
        },
        {
          source: '/_next/static/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable'
            }
          ]
        },
      );
    } else {
      headers.push(
        {
          source: '/static/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'no-store, max-age=0, must-revalidate',
            },
          ],
        },
        {
          source: '/_next/static/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'no-store, max-age=0, must-revalidate',
            },
          ],
        },
      );
    }

    return headers;
  },
};

export default nextConfig;
