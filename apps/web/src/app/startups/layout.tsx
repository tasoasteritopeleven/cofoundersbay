import { AppShellFrame } from '@/components/layout/AppShell';

/**
 * Mounts the application chrome once for this section, so navigating between
 * its pages no longer remounts the sidebar and top bar. Pages keep their own
 * <AppShell title=…> call, which detects the frame and renders only the page
 * header and body.
 */
export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return <AppShellFrame>{children}</AppShellFrame>;
}
