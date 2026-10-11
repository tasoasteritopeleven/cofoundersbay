'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { BilingualText } from '@/components/common/BilingualText';
import { BuilderWorkspace, type BuilderWorkspaceDialog } from '@/components/builder/BuilderWorkspace';
import { BUILDER_BTN } from '@/components/builder/BuilderStageChrome';
import { IdeaCore, ideaCoreCompletion } from '@/components/builder/IdeaCore';
import { BusinessModelCanvas, bmcCompletion } from '@/components/builder/BusinessModelCanvas';
import { MarketAnalysis, marketCompletion } from '@/components/builder/MarketAnalysis';
import { MVPPlanner, mvpCompletion } from '@/components/builder/MVPPlanner';
import { FinancialPlanning, financialCompletion } from '@/components/builder/FinancialPlanning';
import { PitchDeckBuilder, pitchDeckCompletion, type PitchDeckData } from '@/components/builder/PitchDeckBuilder';
import { ReadinessScoring } from '@/components/builder/ReadinessScoring';
import { ApplicationGenerator } from '@/components/builder/ApplicationGenerator';
import { BuilderProvider, useBuilder } from '@/contexts/BuilderContext';
import { CollabToolbar } from '@/components/builder/CollabToolbar';
import { WorkspaceMetricsPanels } from '@/components/gamification/WorkspaceMetricsPanels';
import { BehavioralNudge } from '@/components/behavioral/BehavioralNudge';
import { VersionHistoryDrawer } from '@/components/builder/VersionHistoryDrawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, AlertCircle } from 'lucide-react';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import { bilingualAria } from '@/lib/i18n/format';
import { builderEn, builderEl, builderDocLabel } from '@/lib/i18n/strings-builder';
import type { BuilderDocumentType } from '@/lib/builder-api';
import { FirstRunTour, type TourStep } from '@/components/common/FirstRunTour';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { initialsOf } from '@/lib/utils';

const BUILDER_TOUR: TourStep[] = [
  {
    target: 'builder-context',
    titleEn: 'This is your startup workspace',
    titleEl: 'Αυτός είναι ο χώρος εργασίας του startup σας',
    bodyEn: 'Everything you write here — idea, market, business model, pitch — is stored as artefacts in this workspace. The AI insight button reads them all and proposes what to complete next.',
    bodyEl: 'Ό,τι γράφετε εδώ — ιδέα, αγορά, επιχειρηματικό μοντέλο, pitch — αποθηκεύεται ως παραδοτέα στον χώρο εργασίας. Το κουμπί AI διαβάζει όλα τα παραδοτέα και προτείνει τι να ολοκληρώσετε μετά.',
  },
  {
    target: 'builder-tabs',
    titleEn: 'Work through the stages in order',
    titleEl: 'Προχωρήστε στα στάδια με τη σειρά',
    bodyEn: 'Idea Core → Market → Business Model → MVP → Financials → Pitch. Each tab saves on its own. Progress in earlier stages unlocks the Pitch Deck and Applications tabs.',
    bodyEl: 'Πυρήνας ιδέας → Αγορά → Επιχειρηματικό μοντέλο → MVP → Οικονομικά → Pitch. Κάθε καρτέλα αποθηκεύεται μόνη της. Η πρόοδος στα πρώτα στάδια ξεκλειδώνει τις καρτέλες Pitch Deck και Αιτήσεις.',
  },
  {
    target: 'builder-overview',
    titleEn: 'The overview shows completion per artefact',
    titleEl: 'Η επισκόπηση δείχνει την ολοκλήρωση ανά παραδοτέο',
    bodyEn: 'Each card is one artefact with its completion percentage. Open a card to jump straight to that stage. Version History on any document lets you roll back.',
    bodyEl: 'Κάθε κάρτα είναι ένα παραδοτέο με το ποσοστό ολοκλήρωσης. Ανοίξτε μια κάρτα για να πάτε απευθείας στο στάδιο. Το Ιστορικό εκδόσεων σε κάθε έγγραφο επιτρέπει επαναφορά.',
  },
];

/** Greek for the preview workspace description seeded by `lib/preview-api.ts`. */
const PREVIEW_WS_DESC_EL: Record<string, string> = {
  'Sample workspace — preview demo, not live founder data.':
    'Δείγμα χώρου εργασίας — επίδειξη προεπισκόπησης, όχι πραγματικά δεδομένα ιδρυτή.',
};

/* Tabs whose content mounts its own <PageRail>; on those the page hands its
   sections to that rail instead of mounting a second one over it. */
const SELF_RAIL_TABS = new Set(['overview', 'pitch-deck']);

const TAB_TO_DOC: Record<string, BuilderDocumentType> = {
  'idea-core': 'idea_core',
  bmc: 'business_model_canvas',
  market: 'market_analysis',
  'pitch-deck': 'pitch_deck',
  mvp: 'mvp_plan',
  financials: 'financial_plan',
  applications: 'application',
};

const BUILDER_TABS: { id: string; glyph: CfbGlyphName; labelEn: string; labelEl: string }[] = [
  { id: 'overview', glyph: 'builder', labelEn: builderEn('tab_overview'), labelEl: builderEl('tab_overview') },
  { id: 'idea-core', glyph: 'spark', labelEn: builderEn('tab_idea'), labelEl: builderEl('tab_idea') },
  { id: 'bmc', glyph: 'target', labelEn: builderEn('tab_bmc'), labelEl: builderEl('tab_bmc') },
  { id: 'market', glyph: 'chart', labelEn: builderEn('tab_market'), labelEl: builderEl('tab_market') },
  { id: 'pitch-deck', glyph: 'builder', labelEn: builderEn('tab_pitch'), labelEl: builderEl('tab_pitch') },
  { id: 'mvp', glyph: 'flag', labelEn: builderEn('tab_mvp'), labelEl: builderEl('tab_mvp') },
  { id: 'financials', glyph: 'wallet', labelEn: builderEn('tab_financials'), labelEl: builderEl('tab_financials') },
  { id: 'readiness', glyph: 'award', labelEn: builderEn('tab_readiness'), labelEl: builderEl('tab_readiness') },
  { id: 'applications', glyph: 'applications', labelEn: builderEn('tab_applications'), labelEl: builderEl('tab_applications') },
];

function isBuilderTab(value: string | null): value is string {
  return Boolean(value && BUILDER_TABS.some((tab) => tab.id === value));
}

function builderHref(tab: string): string {
  return tab === 'overview' ? '/builder' : `/builder?tab=${encodeURIComponent(tab)}`;
}

function BuilderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTabState] = useState('overview');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [workspaceDialog, setWorkspaceDialog] = useState<BuilderWorkspaceDialog>(null);

  useEffect(() => {
    const fromUrl = searchParams?.get('tab') ?? null;
    if (isBuilderTab(fromUrl)) setActiveTabState(fromUrl);
  }, [searchParams]);

  const setActiveTab = useCallback(
    (next: string) => {
      if (!isBuilderTab(next)) return;
      setActiveTabState(next);
      router.replace(builderHref(next), { scroll: false });
    },
    [router],
  );

  usePageControls([
    choiceControl(
      'tab',
      'Builder stage',
      'Στάδιο Builder',
      BUILDER_TABS.map((tab) => ({ value: tab.id, en: tab.labelEn, el: tab.labelEl })),
      activeTab,
      (value) => setActiveTab(value),
    ),
  ]);
  const {
    workspace,
    isLoadingWorkspaces,
    documents,
    activeDocument,
    onlineCollaborators,
    error,
    isGenerating,
    loadWorkspaces,
    updateDocumentSection,
    updateDocument,
    generateContent,
    createDocument,
    selectDocument,
    clearError,
  } = useBuilder();

  // The document cards are on screen only on the overview; each stage tab publishes its own rows.
  usePageList([
    {
      id: 'documents',
      labelEn: 'Workspace documents',
      labelEl: 'Έγγραφα χώρου εργασίας',
      rows:
        activeTab === 'overview' && !isLoadingWorkspaces
          ? documents.map((doc) => `${doc.title} · ${doc.status} · ${doc.completionPercent ?? 0}%`)
          : undefined,
      total: documents.length,
    },
  ]);

  useEffect(() => {
    loadWorkspaces(true);
  }, [loadWorkspaces]);

  useEffect(() => {
    const type = TAB_TO_DOC[activeTab];
    if (!type) return;
    const doc = documents.find((d) => d.type === type);
    if (doc && activeDocument?.id !== doc.id) {
      void selectDocument(doc.id);
    }
  }, [activeTab, documents, activeDocument?.id, selectDocument]);

  const ensureStageDocument = async (type: BuilderDocumentType) => {
    const existing = documents.find((d) => d.type === type);
    if (existing) {
      if (activeDocument?.id !== existing.id) await selectDocument(existing.id);
      return existing;
    }
    return createDocument(type, builderDocLabel(type, 'en'));
  };

  const saveStageSection = async (section: string, data: unknown) => {
    const type = TAB_TO_DOC[activeTab];
    const doc = type ? await ensureStageDocument(type) : activeDocument;
    if (!doc) return null;
    await updateDocumentSection(doc.id, section, (data ?? {}) as Record<string, unknown>);
    await selectDocument(doc.id);
    return doc;
  };

  // Each stage passes the figure its own header shows. Written after every section save, because the
  // API recomputes completion from section flags on that save and the overview would disagree.
  const handleSave = async (section: string, data: unknown, completionPercent: number) => {
    const doc = await saveStageSection(section, data);
    if (doc) await updateDocument(doc.id, { completionPercent });
  };

  const handleSavePitch = (data: PitchDeckData) =>
    handleSave('pitchDeck', data, pitchDeckCompletion(data.slides ?? []));

  const handleSaveApplications = async (data: unknown) => {
    try {
      let doc = documents.find((d) => d.type === 'application');
      if (!doc) {
        doc = await createDocument('application', 'Program applications');
      }
      await updateDocumentSection(doc.id, 'applications', { applications: data } as Record<string, any>);
    } catch {
      // BuilderContext already surfaces the error banner.
    }
  };

  const handleGenerate = async (
    documentType: BuilderDocumentType,
    sectionKey?: string,
    context?: Record<string, unknown>,
  ) => {
    try {
      const result = await generateContent(documentType, sectionKey, context);
      return result.content ?? null;
    } catch {
      clearError();
      return null;
    }
  };

  // Get document content by type
  const getDocumentContent = (type: string) => {
    const doc = documents.find((d) => d.type === type);
    return doc?.content || {};
  };

  const rail: PageRailSection[] = [
    {
      id: 'progress',
      glyph: 'chart',
      labelEn: 'Artefacts',
      labelEl: 'Παραδοτέα',
      content: (
        <div className="space-y-2">
          {documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              <BilingualText en="Open a stage to start an artefact." el="Ανοίξτε ένα στάδιο για να ξεκινήσετε ένα παραδοτέο." wrap />
            </p>
          ) : (
            documents.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => {
                  const tab = Object.entries(TAB_TO_DOC).find(([, type]) => type === doc.type)?.[0];
                  if (tab) setActiveTab(tab);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left hover:bg-muted/40"
              >
                <span className="min-w-0 text-sm font-medium leading-snug">{doc.title}</span>
                <span className="page-stat-label shrink-0 tabular-nums text-muted-foreground">{doc.completionPercent ?? 0}%</span>
              </button>
            ))
          )}
        </div>
      ),
    },
    {
      id: 'related',
      glyph: 'flag',
      labelEn: 'Linked pages',
      labelEl: 'Συνδεδεμένες σελίδες',
      content: (
        <div className="grid grid-cols-1 min-w-0 gap-2">
          {/* Only pages that are not already a stage in the strip above.
              Pitch deck, applications and readiness were listed here under the
              same names as their tabs, and they render the very same
              components - PitchDeckBuilder, ApplicationGenerator,
              ReadinessScoring - so the rail read as a copy of the strip, which
              is the one thing it must not be. Nothing became unreachable: each
              is a tab here and keeps its own sidebar entry. */}
          {([
            { href: '/research', en: builderEn('app_link_research'), el: builderEl('app_link_research') },
            { href: '/milestones', en: 'Milestones', el: 'Ορόσημα' },
            { href: '/projects', en: builderEn('app_link_projects'), el: builderEl('app_link_projects') },
            { href: '/fundraising', en: builderEn('app_link_fundraising'), el: builderEl('app_link_fundraising') },
          ] as const).map((step) => (
            <Button key={step.href} asChild variant="outline" className="h-auto min-h-11 justify-start gap-3 whitespace-normal px-3 py-2.5 text-left">
              <Link href={step.href}>
                <span className="min-w-0 flex-1 text-sm font-medium leading-snug">
                  <BilingualText en={step.en} el={step.el} wrap />
                </span>
              </Link>
            </Button>
          ))}
        </div>
      ),
    },
  ];

  if (isLoadingWorkspaces) {
    return (
      <AppShell showHelp rail={rail}>
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Loader2 className="icon-xl animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            <BilingualText en={builderEn('loading')} el={builderEl('loading')} compact />
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      showHelp
      rail={SELF_RAIL_TABS.has(activeTab) ? undefined : rail}
      askAi="Summarize this startup workspace and tell me the next Builder section to complete — Idea Core, BMC, Market, or Pitch."
      contentClassName="builder-copy overflow-x-clip"
    >
      <div className="builder-type builder-copy min-w-0 space-y-6 overflow-x-clip">
        <FirstRunTour tourId="builder" steps={BUILDER_TOUR} ready={!isLoadingWorkspaces && Boolean(workspace)} />
        {/* Error Alert */}
        {error && (
          <div className="flex flex-col gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <AlertCircle className="icon-sm shrink-0 text-destructive-accessible" />
              <p className="text-sm text-destructive-accessible">{error}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={clearError} className="sm:ml-auto">
              <BilingualText en={builderEn('dismiss')} el={builderEl('dismiss')} compact />
            </Button>
          </div>
        )}

        <BehavioralNudge surface="builder" compact />

        {/* Context Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-tour="builder-context">
          <div className="min-w-0">
            {workspace?.name && (
              <p className="page-section font-semibold tracking-tight text-foreground">{workspace.name}</p>
            )}
            <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
              {/* The preview workspace ships an English description; map it so
                  the Greek-primary page is not interrupted. User workspaces
                  render whatever the founder wrote. */}
              {workspace?.description
                ? (PREVIEW_WS_DESC_EL[workspace.description]
                  ? <BilingualText en={workspace.description} el={PREVIEW_WS_DESC_EL[workspace.description]} wrap />
                  : workspace.description)
                : <BilingualText en={builderEn('tagline')} el={builderEl('tagline')} />}
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {/* Ask AI lives in AppShell from `askAi`. A second insight button
                here sat on the same row as the header field. */}
            {onlineCollaborators.length > 0 && (
              <div className="flex items-center gap-1">
                <CfbGlyph name="people" className="icon-sm text-muted-foreground" />
                <div className="flex -space-x-2">
                  {onlineCollaborators.slice(0, 3).map((c) => (
                    <Avatar key={c.odId} className="h-6 w-6 border-2 border-background">
                      <AvatarFallback className="bg-primary/20 text-xs">
                        {initialsOf(c.odName).charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {onlineCollaborators.length > 3 && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-xs">
                      +{onlineCollaborators.length - 3}
                    </div>
                  )}
                </div>
              </div>
            )}
            {isGenerating && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="icon-sm animate-spin" />
                <BilingualText en={builderEn('ai_generating')} el={builderEl('ai_generating')} compact />
              </div>
            )}
            {/* Workspace actions on the overview; the open document's tools on a stage. */}
            {activeTab === 'overview' ? (
              workspace && (
                <>
                  <Button size="sm" variant="outline" className={BUILDER_BTN} onClick={() => setWorkspaceDialog('invite')}>
                    <BilingualText en={builderEn('invite')} el={builderEl('invite')} compact />
                  </Button>
                  <Button size="sm" className={BUILDER_BTN} onClick={() => setWorkspaceDialog('create')}>
                    <BilingualText en={builderEn('new_document')} el={builderEl('new_document')} compact />
                  </Button>
                </>
              )
            ) : (
              activeDocument && workspace && (
                <CollabToolbar
                  documentId={activeDocument.id}
                  workspaceId={workspace.id}
                  documentTitle={activeDocument.title}
                  onHistoryClick={() => setShowVersionHistory(true)}
                />
              )
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex h-auto w-full snap-x snap-mandatory justify-start overflow-x-auto rounded-xl" data-tour="builder-tabs">
            {BUILDER_TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex min-h-10 shrink-0 snap-start items-center gap-1.5 text-xs"
                title={bilingualAria(tab.labelEn, tab.labelEl)}
              >
                <CfbGlyph name={tab.glyph} className="icon-sm" />
                <BilingualText en={tab.labelEn} el={tab.labelEl} compact />
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-6" data-tour="builder-overview">
            <BuilderWorkspace
              onOpenStage={setActiveTab}
              dialog={workspaceDialog}
              onDialogChange={setWorkspaceDialog}
              extraRailSections={rail}
            />
          </TabsContent>

          <TabsContent value="idea-core" className="space-y-6">
            <IdeaCore
              key={documents.find((d) => d.type === 'idea_core')?.id ?? 'idea-core'}
              onSave={(data) => handleSave('ideaCore', data, ideaCoreCompletion(data))}
              onGenerate={(data) => handleGenerate('idea_core', 'ideaCore', { current: data })}
              initialData={getDocumentContent('idea_core')}
              contentRevision={`${documents.find((d) => d.type === 'idea_core')?.id ?? ''}:${documents.find((d) => d.type === 'idea_core')?.version ?? 0}:${documents.find((d) => d.type === 'idea_core')?.updatedAt ?? ''}`}
            />
          </TabsContent>

          <TabsContent value="bmc" className="space-y-6">
            <BusinessModelCanvas
              key={documents.find((d) => d.type === 'business_model_canvas')?.id ?? 'bmc'}
              onSave={(data) => handleSave('bmc', data, bmcCompletion(data))}
              onGenerate={(data) => handleGenerate('business_model_canvas', 'bmc', { current: data })}
              initialData={getDocumentContent('business_model_canvas')}
              contentRevision={`${documents.find((d) => d.type === 'business_model_canvas')?.id ?? ''}:${documents.find((d) => d.type === 'business_model_canvas')?.version ?? 0}:${documents.find((d) => d.type === 'business_model_canvas')?.updatedAt ?? ''}`}
            />
          </TabsContent>

          <TabsContent value="market" className="space-y-6">
            <MarketAnalysis
              key={documents.find((d) => d.type === 'market_analysis')?.id ?? 'market'}
              onSave={(data) => handleSave('marketAnalysis', data, marketCompletion(data))}
              onGenerate={(data) => handleGenerate('market_analysis', 'marketAnalysis', { current: data })}
              initialData={getDocumentContent('market_analysis')}
              contentRevision={`${documents.find((d) => d.type === 'market_analysis')?.id ?? ''}:${documents.find((d) => d.type === 'market_analysis')?.version ?? 0}:${documents.find((d) => d.type === 'market_analysis')?.updatedAt ?? ''}`}
            />
          </TabsContent>

          <TabsContent value="pitch-deck" className="space-y-6">
            <PitchDeckBuilder
              key={documents.find((d) => d.type === 'pitch_deck')?.id ?? 'pitch-deck'}
              hideTitle
              onSave={handleSavePitch}
              onGenerate={(data) => handleGenerate('pitch_deck', 'pitchDeck', { current: data })}
              initialData={getDocumentContent('pitch_deck')}
              contentRevision={`${documents.find((d) => d.type === 'pitch_deck')?.id ?? ''}:${documents.find((d) => d.type === 'pitch_deck')?.version ?? 0}:${documents.find((d) => d.type === 'pitch_deck')?.updatedAt ?? ''}`}
              workspaceName={workspace?.startupName || workspace?.name}
              ideaCore={getDocumentContent('idea_core')}
              bmc={getDocumentContent('business_model_canvas')}
              market={getDocumentContent('market_analysis')}
              extraRailSections={rail}
            />
          </TabsContent>

          <TabsContent value="mvp" className="space-y-6">
            <MVPPlanner
              onSave={(data) => handleSave('mvpPlan', data, mvpCompletion(data))}
              initialData={getDocumentContent('mvp_plan')}
            />
          </TabsContent>

          <TabsContent value="financials" className="space-y-6">
            <FinancialPlanning
              onSave={(data) => handleSave('financials', data, financialCompletion(data))}
              initialData={getDocumentContent('financial_plan')}
            />
          </TabsContent>

          <TabsContent value="readiness" className="space-y-6">
            <ReadinessScoring workspaceId={workspace?.id} workspaceData={documents.reduce((acc, d) => ({ ...acc, [d.type]: d.content }), {})} />
            {workspace?.id && (
              <WorkspaceMetricsPanels workspaceId={workspace.id} />
            )}
          </TabsContent>

          <TabsContent value="applications" className="space-y-6">
            <ApplicationGenerator
              key={documents.find((d) => d.type === 'application')?.id ?? 'applications'}
              onSave={handleSaveApplications}
              onGenerate={(app) => handleGenerate('application', 'applications', { programId: app.id, current: app })}
              initialData={getDocumentContent('application')}
              contentRevision={`${documents.find((d) => d.type === 'application')?.id ?? ''}:${documents.find((d) => d.type === 'application')?.version ?? 0}:${documents.find((d) => d.type === 'application')?.updatedAt ?? ''}`}
              workspaceData={documents.reduce((acc, d) => ({ ...acc, [d.type]: d.content }), {})}
            />
          </TabsContent>
        </Tabs>
      </div>

      {activeDocument && (
        <VersionHistoryDrawer
          open={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          documentId={activeDocument.id}
          documentTitle={activeDocument.title}
          currentVersion={activeDocument.version}
          onRestored={() => {
            setShowVersionHistory(false);
            if (activeDocument) void selectDocument(activeDocument.id);
          }}
        />
      )}
    </AppShell>
  );
}

export default function BuilderPage() {
  return (
    <BuilderProvider>
      <BuilderPageContent />
    </BuilderProvider>
  );
}
