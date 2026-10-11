'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { ApplicationGenerator } from '@/components/builder/ApplicationGenerator';
import { BuilderProvider, useBuilder } from '@/contexts/BuilderContext';
import { CollabToolbar } from '@/components/builder/CollabToolbar';
import { VersionHistoryDrawer } from '@/components/builder/VersionHistoryDrawer';
import { Button } from '@/components/ui/button';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { bilingualAria } from '@/lib/i18n/format';
import { builderEn, builderEl } from '@/lib/i18n/strings-builder';
import { BUILDER_BTN } from '@/components/builder/BuilderStageChrome';
import { ArrowLeft, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import type { ApplicationTemplate } from '@/components/builder/application-model';

const APPLICATION_ASK =
  'Draft empty accelerator or grant answers using only verified Builder artefacts from the active workspace. Ask for missing evidence; do not invent funding, traction or company details. Fill only empty fields.';

function ApplicationsPageContent() {
  const {
    workspace,
    isLoadingWorkspaces,
    documents,
    activeDocument,
    error,
    loadWorkspaces,
    updateDocumentSection,
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
    const application = documents.find((d) => d.type === 'application');
    if (application && activeDocument?.id !== application.id) {
      void selectDocument(application.id);
    }
  }, [documents, activeDocument?.id, selectDocument]);

  const applicationDocument = documents.find((d) => d.type === 'application');
  const rawContent =
    (activeDocument?.type === 'application' ? activeDocument.content : undefined) ??
    applicationDocument?.content ??
    {};
  const contentRevision = `${applicationDocument?.id ?? ''}:${applicationDocument?.version ?? 0}:${applicationDocument?.updatedAt ?? ''}`;
  const askAi = APPLICATION_ASK;

  const handleSave = async (data: unknown) => {
    let doc = documents.find((d) => d.type === 'application');
    if (!doc) {
      doc = await createDocument('application', 'Program applications');
    }
    await updateDocumentSection(doc.id, 'applications', { applications: data } as Record<string, unknown>);
  };

  const handleGenerate = async (app: ApplicationTemplate) => {
    try {
      const result = await generateContent('application', 'applications', { programId: app.id, current: app });
      return result.content ?? null;
    } catch {
      clearError();
      return null;
    }
  };

  if (isLoadingWorkspaces) {
    return (
      <AppShell showHelp>
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Loader2 className="icon-xl animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            <BilingualText en={builderEn('loading_apps')} el={builderEl('loading_apps')} compact />
          </p>
        </div>
      </AppShell>
    );
  }

  const relatedRail: PageRailSection[] = [
    {
      id: 'related',
      glyph: 'flag',
      labelEn: 'Linked pages',
      labelEl: 'Συνδεδεμένες σελίδες',
      content: (
        <div className="grid grid-cols-1 min-w-0 gap-2">
          {([
            { href: '/builder?tab=idea-core', title: 'app_link_idea' },
            { href: '/builder/pitch-deck', title: 'app_link_pitch' },
            { href: '/research', title: 'app_link_research' },
            { href: '/fundraising', title: 'app_link_fundraising' },
            { href: '/projects', title: 'app_link_projects' },
            { href: '/readiness', title: 'app_link_readiness' },
          ] as const).map((step) => (
            <Button key={step.href} asChild variant="outline" className="h-auto min-h-11 justify-start gap-3 whitespace-normal px-3 py-2.5 text-left">
              <Link href={step.href}>
                <span className="min-w-0 flex-1 text-sm font-medium leading-snug">
                  <BilingualText en={builderEn(step.title)} el={builderEl(step.title)} wrap />
                </span>
                <ArrowRight className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </Button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <AppShell
      showHelp
      askAi={askAi}
      contentClassName="builder-copy overflow-x-clip"
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 gap-1.5 ${BUILDER_BTN} text-muted-foreground`}
            aria-label={bilingualAria(builderEn('app_back'), builderEl('app_back'))}
            asChild
          >
            <Link href="/builder">
              <ArrowLeft className="icon-sm" />
              <CfbGlyph name="builder" className="icon-sm" />
              <BilingualText en={builderEn('app_back')} el={builderEl('app_back')} compact />
            </Link>
          </Button>
          {applicationDocument && workspace && (
            <CollabToolbar
              documentId={applicationDocument.id}
              workspaceId={workspace.id}
              documentTitle={applicationDocument.title}
              onHistoryClick={() => setShowVersionHistory(true)}
            />
          )}
        </div>

        <ApplicationGenerator
          key={applicationDocument?.id ?? 'applications'}
          hideTitle
          pageRail
          extraSections={relatedRail}
          onSave={handleSave}
          onGenerate={handleGenerate}
          initialData={rawContent}
          contentRevision={contentRevision}
          workspaceData={documents.reduce((acc, d) => ({ ...acc, [d.type]: d.content }), {})}
        />
      </div>

      {applicationDocument && (
        <VersionHistoryDrawer
          open={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          documentId={applicationDocument.id}
          documentTitle={applicationDocument.title}
          currentVersion={applicationDocument.version}
          onRestored={() => {
            setShowVersionHistory(false);
            void selectDocument(applicationDocument.id);
          }}
        />
      )}
    </AppShell>
  );
}

export default function ApplicationsPage() {
  return (
    <BuilderProvider>
      <ApplicationsPageContent />
    </BuilderProvider>
  );
}
