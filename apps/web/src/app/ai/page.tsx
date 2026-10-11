'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { BilingualText } from '@/components/common/BilingualText';
import { CopilotWorkspace } from '@/components/ai/CopilotWorkspace';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { BUILDER_BTN } from '@/components/builder/BuilderStageChrome';
import { useSession } from '@/hooks/useSession';
import { Button } from '@/components/ui/button';

function AIPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { hasSession, mounted } = useSession();
  const initialPrompt = searchParams?.get('q') ?? undefined;

  if (!mounted) {
    return (
      <AppShell fullHeight contentClassName="min-h-0">
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          <BilingualText en="Loading assistant…" el="Φόρτωση βοηθού…" compact />
        </div>
      </AppShell>
    );
  }

  if (!hasSession) {
    return (
      <AppShell askAi={false} showHelp>
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <CfbGlyph name="spark" className="icon-lg text-muted-foreground" />
          <p className="max-w-md text-sm text-muted-foreground">
            <BilingualText
              en="Sign in to let the assistant read this workspace and act on it."
              el="Συνδεθείτε για να διαβάσει ο βοηθός αυτόν τον χώρο εργασίας και να δράσει πάνω του."
            />
          </p>
          <Button asChild className={BUILDER_BTN}>
            <Link href="/login?redirect=/ai">
              <BilingualText en="Sign in" el="Σύνδεση" compact />
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell fullHeight contentClassName="min-h-0 flex flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* A question arriving in ?q= is sent, not just typed in: eleven
            "Ask AI about this" links land here, and each used to leave the
            reader to press send a second time. The address then drops ?q so
            a reload does not ask again. */}
        <CopilotWorkspace
          variant="page"
          autoPrompt={initialPrompt ?? null}
          onAutoPromptSent={() => router.replace('/ai', { scroll: false })}
        />
      </div>
    </AppShell>
  );
}

export default function AIPage() {
  return (
    <Suspense
      fallback={
        <AppShell fullHeight contentClassName="min-h-0">
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            <BilingualText en="Loading assistant…" el="Φόρτωση βοηθού…" compact />
          </div>
        </AppShell>
      }
    >
      <AIPageInner />
    </Suspense>
  );
}
