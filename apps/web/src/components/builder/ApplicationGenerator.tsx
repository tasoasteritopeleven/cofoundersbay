'use client';

import { useState, useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Save,
  RefreshCw,
  Copy,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { PageRail, type PageRailSection } from '@/components/layout/PageRail';
import { BUILDER_BTN, BuilderStageHeader, useBuilderPrimaryText } from './BuilderStageChrome';
import { ApplicationProgramsChrome } from './ApplicationProgramsChrome';
import {
  deriveApplicationStatus,
  mergeEmptyApplicationAnswers,
  mergeSavedApplications,
  pickGeneratedAnswers,
  requiredCompletion,
  type ApplicationTemplate,
} from './application-model';
import { builderEn, builderEl } from '@/lib/i18n/strings-builder';
import {
  applicationQuestionCopy,
  applicationTipCopy,
} from '@/lib/i18n/strings-application-questions';
import { bilingualAria } from '@/lib/i18n/format';
import { useToast } from '@/components/ui/toast';
import { usePopupChat } from '@/contexts/PopupChatContext';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';

interface ApplicationGeneratorProps {
  onSave?: (data: ApplicationTemplate[]) => void | Promise<void>;
  onGenerate?: (app: ApplicationTemplate) => Promise<unknown>;
  workspaceData?: Record<string, unknown>;
  initialData?: unknown;
  hideTitle?: boolean;
  /** Dedicated /builder/applications page: stats and program picker live in the rail. */
  pageRail?: boolean;
  /** Extra rail families from the host page (linked destinations). */
  extraSections?: PageRailSection[];
  contentRevision?: string;
}

export {
  deriveApplicationStatus,
  mergeSavedApplications,
  requiredCompletion,
} from './application-model';
export type { ApplicationTemplate } from './application-model';

function applicationsEqual(a: ApplicationTemplate, b: ApplicationTemplate): boolean {
  return JSON.stringify(a.questions.map((q) => q.answer)) === JSON.stringify(b.questions.map((q) => q.answer))
    && a.status === b.status;
}

function programAskPrompt(app: ApplicationTemplate): string {
  const empty = app.questions.filter((q) => !q.answer.trim()).map((q) => q.id);
  return [
    `Draft empty ${app.name} answers using only verified artefacts from the active workspace.`,
    'Do not invent funding, traction, people or company details. Ask for missing evidence. Fill only empty fields.',
    empty.length
      ? `Start with the ${empty.length} empty ${empty.length === 1 ? 'answer' : 'answers'}.`
      : 'Every required field has text — propose what to tighten, do not overwrite.',
  ].join(' ');
}

function questionAskPrompt(app: ApplicationTemplate, questionEn: string, filled: boolean): string {
  return filled
    ? `Tighten this ${app.name} answer: ${questionEn}`
    : `Draft an answer to this ${app.name} question using only verified artefacts from the active workspace. Ask for missing evidence instead of inventing facts: ${questionEn}`;
}

export function ApplicationGenerator({
  onSave,
  onGenerate,
  initialData,
  hideTitle = false,
  pageRail = false,
  extraSections,
  contentRevision,
}: ApplicationGeneratorProps) {
  const t = useBuilderPrimaryText();
  const { success, error: toastError } = useToast();
  const { ask } = usePopupChat();
  const [applications, setApplications] = useState<ApplicationTemplate[]>(() => mergeSavedApplications(initialData));
  const [activeApp, setActiveApp] = useState<string>('yc');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingQuestionId, setGeneratingQuestionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fieldPrefix = useId();
  const answerFields = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const saving = useRef(false);
  const latestApplications = useRef(applications);
  latestApplications.current = applications;
  const focusQuestion = (id: string) => {
    const field = answerFields.current[id];
    if (!field) throw new Error('This question is not available in the active application.');
    field.focus({ preventScroll: true });
    field.scrollIntoView?.({ block: 'center', behavior: 'instant' });
  };

  useEffect(() => {
    setApplications(mergeSavedApplications(initialData));
    // Reload when the document version changes (save / restore), not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentRevision]);

  const currentApp = applications.find((a) => a.id === activeApp);

  const generateWithAI = async () => {
    if (!currentApp) return;
    if (!onGenerate) {
      ask(programAskPrompt(currentApp));
      return;
    }
    setIsGenerating(true);
    try {
      const raw = await onGenerate(currentApp);
      if (raw == null) {
        toastError('Could not generate');
        return;
      }
      const incoming = pickGeneratedAnswers(raw);
      const latest = latestApplications.current.find((app) => app.id === currentApp.id) ?? currentApp;
      const merged = mergeEmptyApplicationAnswers(latest, incoming);
      if (applicationsEqual(latest, merged)) {
        success('Nothing to change');
        return;
      }
      setApplications((prev) => prev.map((app) => (app.id === currentApp.id ? mergeEmptyApplicationAnswers(app, incoming) : app)));
      success('Draft filled empty answers only.');
    } catch {
      toastError('Could not generate');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateOneAnswer = async (questionId: string, promptEn: string) => {
    if (!currentApp) return;
    const question = currentApp.questions.find((q) => q.id === questionId);
    if (!question) return;
    if (question.answer.trim()) {
      ask(questionAskPrompt(currentApp, promptEn, true));
      return;
    }
    if (!onGenerate) {
      ask(questionAskPrompt(currentApp, promptEn, false));
      return;
    }
    setGeneratingQuestionId(questionId);
    try {
      const raw = await onGenerate(currentApp);
      if (raw == null) {
        toastError('Could not generate');
        return;
      }
      const incoming = pickGeneratedAnswers(raw);
      const draft = incoming[questionId];
      if (!draft?.trim()) {
        ask(questionAskPrompt(currentApp, promptEn, false));
        return;
      }
      const latest = latestApplications.current.find((app) => app.id === currentApp.id) ?? currentApp;
      if (latest.questions.find((q) => q.id === questionId)?.answer.trim()) {
        success('Nothing to change');
        return;
      }
      setApplications((prev) => prev.map((app) => (app.id === currentApp.id ? mergeEmptyApplicationAnswers(app, { [questionId]: draft }) : app)));
      success('Draft filled empty answers only.');
    } catch {
      toastError('Could not generate');
    } finally {
      setGeneratingQuestionId(null);
    }
  };

  const updateAnswer = (questionId: string, answer: string) => {
    setApplications((prev) => prev.map((app) => {
      if (app.id !== activeApp) return app;
      const next: ApplicationTemplate = {
        ...app,
        questions: app.questions.map((q) =>
          q.id === questionId ? { ...q, answer } : q,
        ),
      };
      return { ...next, status: deriveApplicationStatus(next) };
    }));
  };

  const copyToClipboard = (text: string, id: string) => {
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopiedId(id);
    success('Copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const saveUnavailable = !onSave
    ? { en: 'Saving is unavailable in this view.', el: 'Η αποθήκευση δεν είναι διαθέσιμη σε αυτή την προβολή.' }
    : isSaving || isGenerating || generatingQuestionId
      ? { en: 'Wait for the current operation to finish.', el: 'Περιμένετε να ολοκληρωθεί η τρέχουσα ενέργεια.' }
      : null;

  const persistApplications = async (next: ApplicationTemplate[], propagateError = false) => {
    if (!onSave || saving.current || isGenerating || generatingQuestionId) {
      if (propagateError) throw new Error(saveUnavailable?.en ?? 'Saving is already in progress.');
      return false;
    }
    saving.current = true;
    setIsSaving(true);
    try {
      await onSave(next);
      return true;
    } catch {
      toastError('Could not save');
      if (propagateError) throw new Error(bilingualAria('Could not save', 'Η αποθήκευση απέτυχε'));
      return false;
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  const handleSave = async (propagateError = false) => {
    if (await persistApplications(applications, propagateError)) {
      success('Applications saved', 'Written to the workspace artefact.');
    }
  };

  const markSubmitted = async () => {
    if (!currentApp || requiredCompletion(currentApp) < 100) return;
    const nextList = applications.map((app) => (
      app.id === activeApp ? { ...app, status: 'submitted' as const } : app
    ));
    if (await persistApplications(nextList)) {
      setApplications(nextList);
      success('Marked submitted', 'The programme stays in this workspace artefact.');
    }
  };

  usePageControls([
    choiceControl(
      'active_program',
      'Active program',
      'Ενεργό πρόγραμμα',
      applications.map((app) => ({ value: app.id, en: app.name, el: app.name })),
      activeApp,
      setActiveApp,
    ),
    {
      id: 'save_applications',
      labelEn: 'Save programme applications',
      labelEl: 'Αποθήκευση αιτήσεων προγράμματος',
      writes: true,
      options: [{ value: 'all', labelEn: 'All four templates', labelEl: 'Και τα τέσσερα πρότυπα' }],
      unavailableEn: saveUnavailable?.en,
      unavailableEl: saveUnavailable?.el,
      run: () => handleSave(true),
    },
    {
      id: 'focus_application_question',
      labelEn: 'Go to application question',
      labelEl: 'Μετάβαση σε ερώτηση αίτησης',
      writes: false,
      options: (currentApp?.questions ?? []).map((question, index) => {
        const prompt = applicationQuestionCopy(question.id, question.question);
        return { value: question.id, labelEn: `${index + 1}. ${prompt.en}`, labelEl: `${index + 1}. ${prompt.el}` };
      }),
      unavailableEn: isSaving ? 'Wait for saving to finish.' : undefined,
      unavailableEl: isSaving ? 'Περιμένετε να ολοκληρωθεί η αποθήκευση.' : undefined,
      run: (id) => focusQuestion(id ?? ''),
    },
  ]);
  usePageList([
    {
      id: 'applications',
      labelEn: 'Programme applications',
      labelEl: 'Αιτήσεις σε προγράμματα',
      rows: applications.map((app) =>
        `${app.name} · ${deriveApplicationStatus(app)} · ${requiredCompletion(app)}% of required answers${app.id === activeApp ? ' · open' : ''}`,
      ),
      total: applications.length,
    },
  ]);

  const rail: PageRailSection[] = [
    {
      id: 'progress',
      glyph: 'chart',
      labelEn: 'Application progress',
      labelEl: 'Πρόοδος αιτήσεων',
      content: (
        <ApplicationProgramsChrome
          applications={applications}
          activeApp={activeApp}
          onSelect={setActiveApp}
          layout="rail"
          part="stats"
        />
      ),
    },
    {
      id: 'programs',
      glyph: 'applications',
      labelEn: 'Programs',
      labelEl: 'Προγράμματα',
      badge: applications.filter((app) => app.status === 'in-progress' || app.status === 'completed' || app.status === 'submitted').length || null,
      content: (
        <ApplicationProgramsChrome
          applications={applications}
          activeApp={activeApp}
          onSelect={setActiveApp}
          layout="rail"
          part="picker"
        />
      ),
    },
  ];

  return (
    <>
      {pageRail ? <PageRail sections={[...rail, ...(extraSections ?? [])]} /> : null}
    <div className="w-full space-y-6">
      <BuilderStageHeader
        glyph="applications"
        titleEn={builderEn('app_title')}
        titleEl={builderEl('app_title')}
        subtitleEn={builderEn('app_sub')}
        subtitleEl={builderEl('app_sub')}
        hideTitle={hideTitle}
        leading={hideTitle && currentApp ? (
          <p className="text-sm text-muted-foreground">
            <BilingualText
              en={`${currentApp.questions.filter((q) => q.required && !q.answer.trim()).length} required answers remaining. AI drafts stay editable until you save.`}
              el={`${currentApp.questions.filter((q) => q.required && !q.answer.trim()).length} υποχρεωτικές απαντήσεις απομένουν. Τα προσχέδια AI παραμένουν επεξεργάσιμα μέχρι την αποθήκευση.`}
              wrap
            />
          </p>
        ) : undefined}
        showAskAi={!hideTitle}
        askPrompt={currentApp ? programAskPrompt(currentApp) : undefined}
        extraActions={
          <>
            <Button variant="outline" size="sm" className={BUILDER_BTN} onClick={() => void generateWithAI()} disabled={isGenerating || isSaving || generatingQuestionId != null}>
              {isGenerating ? <RefreshCw className="icon-sm mr-2 animate-spin" /> : <CfbGlyph name="spark" className="icon-sm mr-2" />}
              <BilingualText
                en={isGenerating ? builderEn('generating') : builderEn('ai_generate')}
                el={isGenerating ? builderEl('generating') : builderEl('ai_generate')}
                compact
              />
            </Button>
            <Button size="sm" className={BUILDER_BTN} onClick={() => void handleSave()} disabled={saveUnavailable != null} title={saveUnavailable ? bilingualAria(saveUnavailable.en, saveUnavailable.el) : undefined}>
              <Save className="icon-sm mr-2" />
              <BilingualText en={builderEn('app_save_all')} el={builderEl('app_save_all')} compact />
            </Button>
          </>
        }
      />

      {!pageRail && (
        <ApplicationProgramsChrome
          applications={applications}
          activeApp={activeApp}
          onSelect={setActiveApp}
          layout="cards"
        />
      )}

      {currentApp && (
        <Card className="rounded-xl">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CfbGlyph name={currentApp.glyph} className="icon-sm shrink-0 text-muted-foreground" />
                <div>
                  <CardTitle>
                    {currentApp.name}{' '}
                    <BilingualText en={builderEn('app_application')} el={builderEl('app_application')} compact />
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {currentApp.questions.length}{' '}
                    <BilingualText en={builderEn('app_questions')} el={builderEl('app_questions')} compact />
                    {' · '}
                    {requiredCompletion(currentApp)}% <BilingualText en={builderEn('complete')} el={builderEl('complete')} compact />
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {requiredCompletion(currentApp) === 100 && currentApp.status !== 'submitted' && (
                  <Button variant="outline" size="sm" className={BUILDER_BTN} onClick={() => void markSubmitted()} disabled={saveUnavailable != null} title={saveUnavailable ? bilingualAria(saveUnavailable.en, saveUnavailable.el) : undefined}>
                    <CheckCircle2 className="icon-sm mr-2" />
                    <BilingualText en={builderEn('app_mark_submitted')} el={builderEl('app_mark_submitted')} compact />
                  </Button>
                )}
                {currentApp.website && (
                  <Button asChild variant="outline" size="sm" className={BUILDER_BTN}>
                    {currentApp.website.startsWith('http') ? (
                      <a
                        href={currentApp.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={bilingualAria(builderEn('app_view'), builderEl('app_view'))}
                      >
                        <ExternalLink className="icon-sm mr-2" />
                        <BilingualText en={builderEn('app_view')} el={builderEl('app_view')} compact />
                      </a>
                    ) : (
                      <Link
                        href={currentApp.website}
                        aria-label={bilingualAria(builderEn('app_view'), builderEl('app_view'))}
                      >
                        <ExternalLink className="icon-sm mr-2" />
                        <BilingualText en={builderEn('app_view')} el={builderEl('app_view')} compact />
                      </Link>
                    )}
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor={`${fieldPrefix}-question-nav`}>
                <BilingualText en="Go to question" el="Μετάβαση σε ερώτηση" compact />
              </Label>
              <select
                id={`${fieldPrefix}-question-nav`}
                value=""
                disabled={isSaving}
                onChange={(event) => { if (event.target.value) focusQuestion(event.target.value); }}
                className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-ring"
              >
                <option value="">{t('Choose a question', 'Επιλέξτε ερώτηση')}</option>
                {currentApp.questions.map((question, index) => {
                  const prompt = applicationQuestionCopy(question.id, question.question);
                  const status = question.answer.trim() ? t('Answered', 'Απαντήθηκε') : t('Unanswered', 'Αναπάντητη');
                  return <option key={question.id} value={question.id}>{index + 1}. {t(prompt.en, prompt.el)} — {status}</option>;
                })}
              </select>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentApp.questions.map((question, index) => {
              const prompt = applicationQuestionCopy(question.id, question.question);
              const tip = applicationTipCopy(question.id, question.tips);
              const busy = generatingQuestionId === question.id;
              const fieldId = `${fieldPrefix}-${question.id}`;
              const overLimit = question.maxLength != null && question.answer.length > question.maxLength;
              const describedBy = [tip && `${fieldId}-tip`, question.maxLength && `${fieldId}-count`].filter(Boolean).join(' ') || undefined;
              return (
                <div key={question.id} className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Label htmlFor={fieldId} className="flex min-w-0 flex-[1_1_20rem] items-start gap-2">
                      <span className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span>
                        <BilingualText en={prompt.en} el={prompt.el} />
                        {question.required && <span className="ml-1 text-status-danger">*</span>}
                      </span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={BUILDER_BTN}
                        aria-label={bilingualAria(builderEn('app_ask_fill'), builderEl('app_ask_fill'))}
                        disabled={generatingQuestionId != null || isGenerating || isSaving}
                        onClick={() => void generateOneAnswer(question.id, prompt.en)}
                      >
                        {busy ? <RefreshCw className="icon-sm animate-spin" /> : <CfbGlyph name="spark" className="icon-sm" />}
                        <span className="sr-only">
                          <BilingualText en={builderEn('app_ask_fill')} el={builderEl('app_ask_fill')} compact />
                        </span>
                      </Button>
                      {question.answer && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={BUILDER_BTN}
                          onClick={() => copyToClipboard(question.answer, question.id)}
                          aria-label={copiedId === question.id
                            ? bilingualAria('Answer copied', 'Η απάντηση αντιγράφηκε')
                            : bilingualAria('Copy this answer', 'Αντιγραφή απάντησης')}
                          title={copiedId === question.id
                            ? bilingualAria('Answer copied', 'Η απάντηση αντιγράφηκε')
                            : bilingualAria('Copy this answer', 'Αντιγραφή απάντησης')}
                        >
                          {copiedId === question.id ? (
                            <CheckCircle2 className="icon-sm text-status-success" aria-hidden="true" />
                          ) : (
                            <Copy className="icon-sm" aria-hidden="true" />
                          )}
                        </Button>
                      )}
                      {question.maxLength && (
                        <Badge id={`${fieldId}-count`} variant="outline" className={cn('rounded-xl text-xs tabular-nums', overLimit && 'text-status-danger')}>
                          {question.answer.length}/{question.maxLength}
                          {overLimit && <span className="sr-only">{t('Character limit exceeded', 'Υπέρβαση ορίου χαρακτήρων')}</span>}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Textarea
                    id={fieldId}
                    ref={(field) => { answerFields.current[question.id] = field; }}
                    required={question.required}
                    aria-describedby={describedBy}
                    aria-invalid={overLimit || undefined}
                    aria-busy={busy || isGenerating}
                    readOnly={isSaving}
                    value={question.answer}
                    onChange={(e) => updateAnswer(question.id, e.target.value)}
                    placeholder={t(builderEn('app_answer_ph'), builderEl('app_answer_ph'))}
                    className={cn(
                      'min-h-[100px] rounded-xl',
                      question.maxLength && question.answer.length > question.maxLength && 'border-status-danger',
                    )}
                    maxLength={question.maxLength ? question.maxLength * 1.5 : undefined}
                  />

                  {tip && (
                    <p id={`${fieldId}-tip`} className="flex items-start gap-1 text-xs text-muted-foreground">
                      <CfbGlyph name="spark" className="icon-sm mt-0.5 shrink-0" />
                      <BilingualText en={tip.en} el={tip.el} />
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
    </>
  );
}
