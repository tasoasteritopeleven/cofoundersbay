'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { PitchDeckBuilder, pitchDeckCompletion, type PitchDeckData } from '@/components/builder/PitchDeckBuilder';
import { BuilderProvider, useBuilder } from '@/contexts/BuilderContext';
import { CollabToolbar } from '@/components/builder/CollabToolbar';
import { VersionHistoryDrawer } from '@/components/builder/VersionHistoryDrawer';
import { PitchPublication } from '@/components/builder/PitchPublication';
import { Button } from '@/components/ui/button';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { bilingualAria } from '@/lib/i18n/format';
import { builderEn, builderEl } from '@/lib/i18n/strings-builder';
import { BUILDER_BTN } from '@/components/builder/BuilderStageChrome';
import { ArrowLeft, Loader2, AlertCircle, ArrowRight } from 'lucide-react';

function PitchDeckPageContent() {
  const {
    workspace,
    documents,
    activeDocument,
    isLoadingWorkspaces,
    error,
    loadWorkspaces,
    updateDocumentSection,
    updateDocument,
    createDocument,
    selectDocument,
    generateContent,
    clearError,
  } = useBuilder();
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  useEffect(() => {
    loadWorkspaces(true);
  }, [loadWorkspaces]);

  useEffect(() => {
    const pitch = documents.find((d) => d.type === 'pitch_deck');
    if (pitch && activeDocument?.id !== pitch.id) {
      void selectDocument(pitch.id);
    }
  }, [documents, activeDocument?.id, selectDocument]);

  const pitchDocument = documents.find((d) => d.type === 'pitch_deck');
  const rawContent =
    (activeDocument?.type === 'pitch_deck' ? activeDocument.content : undefined) ??
    pitchDocument?.content ??
    {};

  const ideaCore = documents.find((d) => d.type === 'idea_core')?.content ?? {};
  const bmc = documents.find((d) => d.type === 'business_model_canvas')?.content ?? {};
  const market = documents.find((d) => d.type === 'market_analysis')?.content ?? {};
  const workspaceName = workspace?.startupName || workspace?.name || '';
  const contentRevision = `${pitchDocument?.id ?? ''}:${pitchDocument?.version ?? 0}:${pitchDocument?.updatedAt ?? ''}`;

  const rail: PageRailSection[] = [
    {
      id: 'from',
      glyph: 'builder',
      labelEn: 'From the workspace',
      labelEl: 'Από τον χώρο εργασίας',
      content: (
        <div className="grid grid-cols-1 min-w-0 gap-2">
          {([
            { href: '/builder?tab=idea-core', en: builderEn('tab_idea'), el: builderEl('tab_idea') },
            { href: '/builder?tab=bmc', en: builderEn('tab_bmc'), el: builderEl('tab_bmc') },
            { href: '/builder?tab=market', en: builderEn('tab_market'), el: builderEl('tab_market') },
          ] as const).map((step) => (
            <Button key={step.href} asChild variant="outline" className="h-auto min-h-11 justify-start gap-3 whitespace-normal px-3 py-2.5 text-left">
              <Link href={step.href}>
                <span className="min-w-0 flex-1 text-sm font-medium leading-snug">
                  <BilingualText en={step.en} el={step.el} wrap />
                </span>
                <ArrowRight className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </Button>
          ))}
        </div>
      ),
    },
    {
      id: 'public',
      glyph: 'discover',
      labelEn: 'Public link',
      labelEl: 'Δημόσιος σύνδεσμος',
      content: <PitchPublication documentId={pitchDocument?.id} />,
    },
    {
      id: 'related',
      glyph: 'flag',
      labelEn: 'Linked pages',
      labelEl: 'Συνδεδεμένες σελίδες',
      content: (
        <div className="grid grid-cols-1 min-w-0 gap-2">
          {([
            { href: '/builder/applications', en: builderEn('tab_applications'), el: builderEl('tab_applications') },
            { href: '/research', en: builderEn('app_link_research'), el: builderEl('app_link_research') },
            { href: '/fundraising', en: builderEn('app_link_fundraising'), el: builderEl('app_link_fundraising') },
            { href: '/readiness', en: builderEn('app_link_readiness'), el: builderEl('app_link_readiness') },
          ] as const).map((step) => (
            <Button key={step.href} asChild variant="outline" className="h-auto min-h-11 justify-start gap-3 whitespace-normal px-3 py-2.5 text-left">
              <Link href={step.href}>
                <span className="min-w-0 flex-1 text-sm font-medium leading-snug">
                  <BilingualText en={step.en} el={step.el} wrap />
                </span>
                <ArrowRight className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </Button>
          ))}
        </div>
      ),
    },
  ];

  const handleSave = async (data: PitchDeckData) => {
    let doc = documents.find((d) => d.type === 'pitch_deck');
    if (!doc) {
      doc = await createDocument(
        'pitch_deck',
        data.companyName ? `${data.companyName} Pitch Deck` : 'Pitch Deck',
      );
    }
    await updateDocumentSection(doc.id, 'pitchDeck', { ...data } as unknown as Record<string, unknown>);
    const slides = Array.isArray(data.slides) ? data.slides : [];
    await updateDocument(doc.id, { completionPercent: pitchDeckCompletion(slides) });
  };

  const handleGenerate = async (data: PitchDeckData) => {
    try {
      const result = await generateContent('pitch_deck', 'pitchDeck', { current: data });
      return result.content ?? null;
    } catch {
      clearError();
      return null;
    }
  };

  if (isLoadingWorkspaces) {
    return (
      <AppShell showHelp rail={rail}>
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Loader2 className="icon-xl animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            <BilingualText en={builderEn('loading_pitch')} el={builderEl('loading_pitch')} compact />
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      showHelp
      contentClassName="builder-copy overflow-x-clip"
      askAi={`Help me complete the investor pitch deck for ${workspaceName || 'this startup'}. Draft only empty slides and empty fields; keep the company name and the ask if they are already written.`}
    >
      <div className="builder-type builder-copy min-w-0 space-y-6 overflow-x-clip">
        {error && (
          <div className="flex flex-col gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <AlertCircle className="icon-md shrink-0 text-destructive-accessible" />
              <p className="text-sm text-destructive-accessible">{error}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={clearError} className="sm:ml-auto">
              <BilingualText en={builderEn('dismiss')} el={builderEl('dismiss')} compact />
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 gap-1.5 ${BUILDER_BTN} text-muted-foreground`}
            aria-label={bilingualAria(builderEn('pitch_back'), builderEl('pitch_back'))}
            asChild
          >
            <Link href="/builder">
              <ArrowLeft className="icon-sm" />
              <CfbGlyph name="builder" className="icon-sm" />
              <BilingualText en={builderEn('pitch_back')} el={builderEl('pitch_back')} compact />
            </Link>
          </Button>
          {pitchDocument && workspace && (
            <CollabToolbar
              documentId={pitchDocument.id}
              workspaceId={workspace.id}
              documentTitle={pitchDocument.title}
              onHistoryClick={() => setShowVersionHistory(true)}
            />
          )}
        </div>

        <PitchDeckBuilder
          key={pitchDocument?.id ?? 'pitch-deck'}
          hideTitle
          hideLead
          onSave={handleSave}
          onGenerate={handleGenerate}
          initialData={rawContent}
          contentRevision={contentRevision}
          workspaceName={workspaceName}
          ideaCore={ideaCore}
          bmc={bmc}
          market={market}
          extraRailSections={rail}
        />
      </div>

      {pitchDocument && (
        <VersionHistoryDrawer
          open={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          documentId={pitchDocument.id}
          documentTitle={pitchDocument.title}
          currentVersion={pitchDocument.version}
          onRestored={() => {
            setShowVersionHistory(false);
            void selectDocument(pitchDocument.id);
          }}
        />
      )}
    </AppShell>
  );
}

export default function PitchDeckPage() {
  return (
    <BuilderProvider>
      <PitchDeckPageContent />
    </BuilderProvider>
  );
}
