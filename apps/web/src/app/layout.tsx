import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Inter, Commissioner, JetBrains_Mono, Manrope } from 'next/font/google';
import './globals.css';

/*
 * Brand typography.
 *
 * Both families are self-hosted by next/font (no runtime request to Google,
 * no layout shift, size-adjusted fallback). Both cover Greek — a hard
 * requirement for a bilingual UI: the previous display fonts (Space Grotesk,
 * Sora) have no Greek glyphs, so mixed-language headings would have fallen
 * back mid-string. Until now none of the fonts were actually loaded and the
 * whole product rendered in the OS default.
 *
 *  - Inter        body / UI text: neutral, excellent Greek, tabular figures
 *  - Commissioner display: a humanist grotesque by Kostas Bartsokas with
 *                 Greek designed in, not bolted on. Distinct from Inter at
 *                 heading sizes without being ornamental.
 *  - JetBrains Mono  the technical voice on the match-analysis screens. Those
 *                 screens already asked for it in 17 inline `fontFamily`
 *                 declarations, but nothing ever loaded it, so every one of
 *                 them fell through to whatever generic monospace the device
 *                 happened to have — Consolas on Windows, Menlo on iOS, Roboto
 *                 Mono on Android. Self-hosting it makes that screen look the
 *                 same everywhere, which was the point of self-hosting the
 *                 other two.
 */
const inter = Inter({
  subsets: ['latin', 'latin-ext', 'greek', 'greek-ext'],
  display: 'swap',
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext', 'greek'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-mono',
});

const commissioner = Commissioner({
  subsets: ['latin', 'latin-ext', 'greek'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-display-brand',
});

/*
 * Compact “Co” lettermark only (Latin C + o). Manrope is a semi-geometric
 * grotesque with even stroke and a compact “C”/“o” pair — more designed
 * than Commissioner, never script or handwritten, and it sits symmetrically
 * in a circular chat bubble.
 */
const coMarkFont = Manrope({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--font-co-mark',
});
import { RoleTheme } from '@/components/layout/RoleTheme';
import { ToastProvider } from '@/components/ui/toast';
import { NetworkProvider, OfflineBanner } from '@/components/common/OfflineIndicator';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { RoleProvider } from '@/contexts/RoleContext';
import { ServiceWorkerRegistration } from '@/components/common/ServiceWorkerRegistration';
import { SidebarProvider } from '@/components/layout/SidebarContext';
import { PageRailProvider } from '@/components/layout/PageRailContext';
import { SkipToContent } from '@/components/layout/SkipToContent';
import { GlobalFloatingUi } from '@/components/layout/GlobalFloatingUi';
import { PopupChatProvider } from '@/contexts/PopupChatContext';
import { MessagingProvider } from '@/contexts/MessagingContext';
import { TenantProvider } from '@/components/providers/TenantContext';
import { DemoDataProvider } from '@/contexts/DemoDataContext';
import { PageSnapshotProvider } from '@/contexts/PageSnapshotContext';
import { ApiHealthProbe } from '@/components/providers/ApiHealthProbe';
import { PostHogProvider } from '@/components/providers/PostHogProvider';
import { LanguagePreferenceProvider } from '@/lib/i18n/LanguagePreferenceContext';
import { LocaleSync } from '@/components/common/LocaleSync';
import { PreviewSessionGuard } from '@/components/common/PreviewSessionGuard';
import { I18nProvider } from '@/components/common/I18nProvider';
import { DomI18n } from '@/components/common/DomI18n';
import { PhonePlaceholderFit } from '@/components/layout/PhonePlaceholderFit';
import { IosFieldZoom } from '@/components/layout/IosFieldZoom';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';

export const metadata: Metadata = {
  title: {
    default: 'CoFounderBay',
    template: '%s | CoFounderBay',
  },
  description: 'Startup ecosystem networking for founders, mentors, and investors',
  keywords: ['startup', 'founder', 'cofounder', 'mentor', 'investor', 'networking', 'entrepreneurship'],
  authors: [{ name: 'CoFounderBay' }],
  icons: {
    icon: [
      { url: '/icons/logo-surf.png', type: 'image/png' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/logo-surf.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'CoFounderBay',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  width: 'device-width',
  initialScale: 1,
  // Do NOT lock zoom: maximumScale/userScalable:false fails WCAG 2.2 SC 1.4.4 (Resize Text)
  // and SC 1.4.10 (Reflow). Users must be able to pinch-zoom up to at least 5x.
  // IosFieldZoom caps it on iOS only, where pinch zoom ignores the cap.
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-bilingual="en-el"
      data-scroll-behavior="smooth"
      className={`scroll-smooth ${inter.variable} ${commissioner.variable} ${jetbrainsMono.variable} ${coMarkFont.variable}`}
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        className="bg-background text-foreground font-sans antialiased"
      >
        {/* Single skip link for the whole app (WCAG 2.4.1). AppShell used to render
            a second one, so keyboard users hit the same link twice. */}
        <SkipToContent />
        <ErrorBoundary>
          <QueryProvider>
            <LanguagePreferenceProvider>
              <I18nProvider>
                <LocaleSync />
                <TenantProvider>
                  <RoleProvider>
                    <SidebarProvider>
                      <PageRailProvider>
                      <ServiceWorkerRegistration />
                      <NetworkProvider>
                        <ApiHealthProbe />
                        <ToastProvider>
                          <ConfirmProvider>
                            <PopupChatProvider>
                              <MessagingProvider>
                                <DemoDataProvider>
                                  <RoleTheme>
                                    <PreviewSessionGuard />
                                    <DomI18n>
                                    <PhonePlaceholderFit />
                                    <IosFieldZoom />
                                      {/* Above both the page and the floating
                                          assistant, because the page writes
                                          what is on screen and the assistant
                                          reads it. */}
                                      <PageSnapshotProvider>
                                      <OfflineBanner />
                                      {children}
                                      <GlobalFloatingUi />
                                      <Suspense fallback={null}>
                                        <PostHogProvider />
                                      </Suspense>
                                      </PageSnapshotProvider>
                                    </DomI18n>
                                  </RoleTheme>
                                </DemoDataProvider>
                              </MessagingProvider>
                            </PopupChatProvider>
                          </ConfirmProvider>
                        </ToastProvider>
                      </NetworkProvider>
                      </PageRailProvider>
                    </SidebarProvider>
                  </RoleProvider>
                </TenantProvider>
              </I18nProvider>
            </LanguagePreferenceProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
