'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Sparkles,
  Sliders,
  MessageSquare,
  Shield,
  Zap,
  Languages,
  ThermometerSun,
  ArrowLeft,
  Save,
  Loader2,
  Info,
  CheckCircle2,
  Bot,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { getAIModels, getAIAgents, getAIHealth, getAIPreferences, updateAIPreferences, type AgentConfig } from '@/lib/ai-api';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { LanguageChipGrid } from '@/components/common/LanguageSwitcher';
import { applyLocale } from '@/lib/locale';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/common/I18nProvider';
import { BilingualText } from '@/components/common/BilingualText';
import { qk, queryKeys } from '@/lib/query-keys';
import { choiceControl, usePageControls, type PageControlRunResult } from '@/lib/page-controls';
import { bilingualInline } from '@/lib/i18n/format';

type AIPreferences = {
  preferredModel: string;
  preferredProvider: string;
  temperature: number;
  maxTokens: number;
  responseStyle: 'concise' | 'detailed' | 'casual' | 'formal';
  responseLanguage: string;
  useEmoji: boolean;
  enableStreaming: boolean;
  enableSuggestions: boolean;
  enableContextMemory: boolean;
  enableAutoSave: boolean;
  saveConversations: boolean;
  shareForTraining: boolean;
  anonymizeData: boolean;
  defaultAgent: string;
};

const DEFAULT_PREFS: AIPreferences = {
  preferredModel: 'llama3.2',
  preferredProvider: 'ollama',
  temperature: 0.7,
  maxTokens: 2048,
  responseStyle: 'concise',
  responseLanguage: 'en',
  useEmoji: false,
  enableStreaming: true,
  enableSuggestions: true,
  enableContextMemory: true,
  enableAutoSave: true,
  saveConversations: true,
  shareForTraining: false,
  anonymizeData: true,
  defaultAgent: 'general',
};

const RESPONSE_STYLES = [
  { value: 'concise', label: 'Concise', desc: 'Short, to-the-point answers' },
  { value: 'detailed', label: 'Detailed', desc: 'Comprehensive explanations' },
  { value: 'casual', label: 'Casual', desc: 'Friendly, conversational tone' },
  { value: 'formal', label: 'Formal', desc: 'Professional, business-like' },
];

/** The product's switch, with this page's prop names. See the note on the same
    wrapper in `settings/page.tsx`: the hand-rolled copy this replaces had a
    square track, so `rounded-full` drew a circle. */
function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />;
}

export default function AISettingsPage() {
  const { success, error: showError } = useToast();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<AIPreferences>(DEFAULT_PREFS);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch AI health status
  const { data: health } = useQuery({
    queryKey: qk('ai', 'health'),
    queryFn: () => getAIHealth().catch(() => ({ available: false, models: [] })),
    staleTime: 30000,
  });

  // Fetch available models
  const { data: modelsData } = useQuery({
    queryKey: qk('ai', 'models'),
    queryFn: () => getAIModels().catch(() => ({ models: [] })),
    staleTime: 60000,
  });

  // Fetch available agents
  const { data: agentsData } = useQuery({
    queryKey: qk('ai', 'agents'),
    queryFn: () => getAIAgents().catch(() => ({ agents: [] })),
    staleTime: 60000,
  });

  const models = modelsData?.models || [];
  const agents = agentsData?.agents || [];
  const isAIAvailable = health?.available ?? false;

  const updatePref = <K extends keyof AIPreferences>(key: K, value: AIPreferences[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async (): Promise<PageControlRunResult> => {
    try {
      await updateAIPreferences(prefs);
      localStorage.setItem('ai-preferences', JSON.stringify(prefs));
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiPreferences });
      success('AI preferences saved');
      setHasChanges(false);
    } catch (err) {
      showError('Failed to save preferences');
      return { error: err instanceof Error && err.message ? err.message : 'Your AI preferences were not saved.' };
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Through the cache under queryKeys.aiPreferences, so the
        // invalidation after a save means the next visit reads it fresh.
        const remote = await queryClient.fetchQuery({
          queryKey: queryKeys.aiPreferences,
          queryFn: getAIPreferences,
          staleTime: 60_000,
        });
        if (cancelled) return;
        if (remote?.preferences) {
          setPrefs({
            ...DEFAULT_PREFS,
            ...Object.fromEntries(
              Object.entries(remote.preferences).filter(([, v]) => v !== null && v !== undefined),
            ),
          } as AIPreferences);
          return;
        }
      } catch {
        /* local fallback */
      }
      try {
        const saved = localStorage.getItem('ai-preferences');
        if (saved && !cancelled) {
          setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(saved) });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Offered to the assistant: every choice on the form, through the same
  // setter (so the unsaved-changes bar appears as it does for a click), and
  // Save, which is the one step that stores anything.
  const FEATURES: { key: keyof AIPreferences; en: string; el: string }[] = [
    { key: 'enableStreaming', en: 'Streaming responses', el: 'Ροή απαντήσεων' },
    { key: 'enableSuggestions', en: 'Suggested questions', el: 'Προτεινόμενες ερωτήσεις' },
    { key: 'enableContextMemory', en: 'Context memory', el: 'Μνήμη πλαισίου' },
    { key: 'enableAutoSave', en: 'Auto-save conversations', el: 'Αυτόματη αποθήκευση συνομιλιών' },
    { key: 'saveConversations', en: 'Save conversations', el: 'Αποθήκευση συνομιλιών' },
    { key: 'anonymizeData', en: 'Anonymise data', el: 'Ανωνυμοποίηση δεδομένων' },
    { key: 'shareForTraining', en: 'Help improve the AI', el: 'Βοήθεια στη βελτίωση του AI' },
    { key: 'useEmoji', en: 'Use emojis', el: 'Χρήση emoji' },
  ];
  const setFlag = (key: keyof AIPreferences, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setHasChanges(true);
  };
  const featureOptions = (on: boolean) =>
    FEATURES.filter((f) => Boolean(prefs[f.key]) === on).map((f) => ({ value: f.key, labelEn: f.en, labelEl: f.el }));
  usePageControls([
    choiceControl('response_style', 'Response style', 'Ύφος απαντήσεων', [
      { value: 'concise', en: 'Concise', el: 'Σύντομο' },
      { value: 'detailed', en: 'Detailed', el: 'Αναλυτικό' },
      { value: 'casual', en: 'Casual', el: 'Φιλικό' },
      { value: 'formal', en: 'Formal', el: 'Επίσημο' },
    ], prefs.responseStyle, (v) => updatePref('responseStyle', v as AIPreferences['responseStyle'])),
    choiceControl('creativity', 'Creativity', 'Δημιουργικότητα', [
      { value: '0.1', en: 'Very precise', el: 'Πολύ ακριβές' },
      { value: '0.3', en: 'Focused', el: 'Εστιασμένο' },
      { value: '0.5', en: 'Balanced', el: 'Ισορροπημένο' },
      { value: '0.7', en: 'Creative', el: 'Δημιουργικό' },
      { value: '0.9', en: 'Very creative', el: 'Πολύ δημιουργικό' },
      { value: '1.0', en: 'Maximum creativity', el: 'Μέγιστη δημιουργικότητα' },
    ], String(prefs.temperature), (v) => updatePref('temperature', parseFloat(v))),
    choiceControl('response_length', 'Response length', 'Μήκος απαντήσεων', [
      { value: '512', en: 'Short', el: 'Σύντομο' },
      { value: '1024', en: 'Medium', el: 'Μεσαίο' },
      { value: '2048', en: 'Long', el: 'Μεγάλο' },
      { value: '4096', en: 'Very long', el: 'Πολύ μεγάλο' },
    ], String(prefs.maxTokens), (v) => updatePref('maxTokens', parseInt(v, 10))),
    ...(agents.length ? [choiceControl('default_agent', 'Default assistant', 'Προεπιλεγμένος βοηθός', agents.map((a: AgentConfig) => ({ value: a.id, en: a.name, el: a.name })), prefs.defaultAgent, (v) => updatePref('defaultAgent', v))] : []),
    ...(models.length ? [choiceControl('preferred_model', 'Preferred model', 'Προτιμώμενο μοντέλο', models.map((m) => ({ value: m.name, en: m.name, el: m.name })), prefs.preferredModel, (v) => updatePref('preferredModel', v))] : []),
    { id: 'feature_on', labelEn: 'Turn an AI option on', labelEl: 'Ενεργοποίηση επιλογής AI', writes: false, options: featureOptions(false), run: (v) => { if (v) setFlag(v as keyof AIPreferences, true); } },
    { id: 'feature_off', labelEn: 'Turn an AI option off', labelEl: 'Απενεργοποίηση επιλογής AI', writes: false, options: featureOptions(true), run: (v) => { if (v) setFlag(v as keyof AIPreferences, false); } },
    {
      id: 'save_ai_preferences',
      labelEn: 'Save AI preferences',
      labelEl: 'Αποθήκευση προτιμήσεων AI',
      writes: true,
      unavailableEn: hasChanges ? undefined : 'There are no unsaved changes.',
      unavailableEl: hasChanges ? undefined : 'Δεν υπάρχουν μη αποθηκευμένες αλλαγές.',
      run: () => handleSave(),
    },
  ]);
  return (
    <AppShell>
      <div className="max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="icon-sm" />
            {t('Back to Settings')}
          </Link>
          {/* The page title lives in the shell header; a second, larger
              "AI Assistant Settings" here made the page open with its own name
              twice. The links beside it stay. */}
          <div className="flex items-center justify-end">
            <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link href="/ai/capabilities">
                <CfbGlyph name="spark" className="h-4 w-4" />
                <BilingualText en="What it can do" el="Τι μπορεί να κάνει" compact />
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/ai">
                <Bot className="h-4 w-4" />
                <BilingualText en="Open assistant" el="Άνοιγμα βοηθού" compact />
              </Link>
            </Button>
            <Button onClick={() => void handleSave()} disabled={!hasChanges} className="gap-2">
              {hasChanges ? <Save className="icon-sm" /> : <CheckCircle2 className="icon-sm" />}
              {hasChanges ? 'Save Changes' : 'Saved'}
            </Button>
            </div>
          </div>
        </div>

        {/* AI Status Banner */}
        <Card className={cn(
          'mb-6 border-2',
          isAIAvailable ? 'border-status-success-border bg-status-success-bg' : 'border-status-warning-border bg-status-warning-bg'
        )}>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full',
                isAIAvailable ? 'bg-status-success-bg' : 'bg-status-warning-bg'
              )}>
                {isAIAvailable ? (
                  <Zap className="icon-md text-status-success" />
                ) : (
                  <Info className="icon-md text-status-warning" />
                )}
              </div>
              <div>
                <p className={cn(
                  'font-medium',
                  isAIAvailable ? 'text-status-success' : 'text-status-warning'
                )}>
                  {isAIAvailable ? 'AI Assistant is Online' : 'AI Assistant is Offline'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {/* Written for the reader, not the operator: "Run: ollama
                      serve" was shown to every user. The built-in copilot
                      answers from platform data without a model, so the
                      assistant is not off - model-written replies are. */}
                  {isAIAvailable ? (
                    <BilingualText
                      en={`${models.length} model(s) available`}
                      el={`${models.length} διαθέσιμα μοντέλα`}
                      wrap
                    />
                  ) : (
                    <BilingualText
                      en="The language model is not reachable right now. The assistant still answers from your platform data; replies written by the model return when it is back."
                      el="Το γλωσσικό μοντέλο δεν είναι διαθέσιμο αυτή τη στιγμή. Ο βοηθός απαντά ακόμη από τα δεδομένα της πλατφόρμας σας· οι απαντήσεις του μοντέλου επιστρέφουν μόλις γίνει ξανά διαθέσιμο."
                      wrap
                    />
                  )}
                  {!isAIAvailable && process.env.NODE_ENV !== 'production' && (
                    <span className="mt-1 block font-mono text-xs">dev: ollama serve</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6">
          {/* Model Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="icon-md text-muted-foreground" />
                <BilingualText en="Model Configuration" el="Ρύθμιση μοντέλου" compact />
              </CardTitle>
              <CardDescription>
                <BilingualText en="Choose which AI model to use and configure its behavior" el="Επιλέξτε ποιο μοντέλο AI θα χρησιμοποιείται και ρυθμίστε τη συμπεριφορά του" wrap />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Model Selection */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="preferredModel"><BilingualText en="Preferred Model" el="Προτιμώμενο μοντέλο" compact /></Label>
                  <Select
                    value={prefs.preferredModel}
                    onValueChange={(v) => updatePref('preferredModel', v)}
                  >
                    <SelectTrigger id="preferredModel" aria-label="Preferred Model">
                      <SelectValue placeholder={bilingualInline("Select model", "Επιλογή μοντέλου")} />
                    </SelectTrigger>
                    <SelectContent>
                      {/* The built-in copilot is a real choice (the demo and
                          any deployment without a model service use it), and
                          without an item for it the select rendered empty. */}
                      <SelectItem value="copilot"><BilingualText en="Built-in copilot · no model service" el="Ενσωματωμένος βοηθός · χωρίς υπηρεσία μοντέλου" wrap /></SelectItem>
                      {models.length > 0 ? (
                        models.map((m) => (
                          <SelectItem key={m.name} value={m.name}>
                            {m.name}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="llama3.2">llama3.2 (recommended)</SelectItem>
                          <SelectItem value="llama3.1:8b">llama3.1:8b</SelectItem>
                          <SelectItem value="mistral">mistral</SelectItem>
                          <SelectItem value="phi-3">phi-3</SelectItem>
                          <SelectItem value="deepseek-r1">deepseek-r1</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    <BilingualText en="The AI model that powers your assistant" el="Το μοντέλο AI που τροφοδοτεί τον βοηθό σας" wrap />
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultAgent"><BilingualText en="Default Agent" el="Προεπιλεγμένος πράκτορας" compact /></Label>
                  <Select
                    value={prefs.defaultAgent}
                    onValueChange={(v) => updatePref('defaultAgent', v)}
                  >
                    <SelectTrigger id="defaultAgent" aria-label="Default Agent">
                      <SelectValue placeholder={bilingualInline("Select agent", "Επιλογή βοηθού")} />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.length > 0 ? (
                        agents.map((a: AgentConfig) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="general"><BilingualText en="General Assistant" el="Γενικός βοηθός" compact /></SelectItem>
                          <SelectItem value="matching"><BilingualText en="Co-Founder Matching" el="Αντιστοίχιση συνιδρυτών" compact /></SelectItem>
                          <SelectItem value="pitch-coach"><BilingualText en="Pitch Coach" el="Προπονητής pitch" compact /></SelectItem>
                          <SelectItem value="research"><BilingualText en="Research Assistant" el="Βοηθός έρευνας" compact /></SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    <BilingualText en="The default AI persona for new conversations" el="Η προεπιλεγμένη περσόνα AI για νέες συνομιλίες" wrap />
                  </p>
                </div>
              </div>

              {/* Temperature Selection */}
              <div className="space-y-2">
                <Label htmlFor="prefs" className="flex items-center gap-2">
                  <ThermometerSun className="icon-sm text-muted-foreground" />
                  <BilingualText en="Creativity (Temperature)" el="Δημιουργικότητα (θερμοκρασία)" compact />
                </Label>
                <Select
                  value={String(prefs.temperature)}
                  onValueChange={(v) => updatePref('temperature', parseFloat(v))}
                >
                  <SelectTrigger id="prefs" aria-label="Creativity (Temperature)" className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.1">0.1 - Very Precise</SelectItem>
                    <SelectItem value="0.3">0.3 - Focused</SelectItem>
                    <SelectItem value="0.5">0.5 - Balanced</SelectItem>
                    <SelectItem value="0.7">0.7 - Creative (Default)</SelectItem>
                    <SelectItem value="0.9">0.9 - Very Creative</SelectItem>
                    <SelectItem value="1.0">1.0 - Maximum Creativity</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  <BilingualText en="Higher values make responses more varied and creative" el="Υψηλότερες τιμές δίνουν πιο ποικίλες και δημιουργικές απαντήσεις" wrap />
                </p>
              </div>

              {/* Max Tokens */}
              <div className="space-y-2">
                <Label htmlFor="prefs-2"><BilingualText en="Max Response Length" el="Μέγιστο μήκος απάντησης" compact /></Label>
                <Select
                  value={String(prefs.maxTokens)}
                  onValueChange={(v) => updatePref('maxTokens', parseInt(v))}
                >
                  <SelectTrigger id="prefs-2" aria-label="Max Response Length" className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="512"><BilingualText en="Short (512 tokens)" el="Σύντομη (512 tokens)" compact /></SelectItem>
                    <SelectItem value="1024"><BilingualText en="Medium (1024 tokens)" el="Μεσαία (1024 tokens)" compact /></SelectItem>
                    <SelectItem value="2048"><BilingualText en="Long (2048 tokens)" el="Μεγάλη (2048 tokens)" compact /></SelectItem>
                    <SelectItem value="4096"><BilingualText en="Very Long (4096 tokens)" el="Πολύ μεγάλη (4096 tokens)" compact /></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Response Style */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="icon-md text-muted-foreground" />
                <BilingualText en="Response Style" el="Ύφος απάντησης" compact />
              </CardTitle>
              <CardDescription>
                <BilingualText en="Customize how the AI communicates with you" el="Προσαρμόστε πώς επικοινωνεί μαζί σας το AI" wrap />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Style Selection */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {RESPONSE_STYLES.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => updatePref('responseStyle', style.value as any)}
                    className={cn(
                      'flex flex-col items-start rounded-lg border-2 p-4 text-left transition-all',
                      prefs.responseStyle === style.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <span className="font-medium">{style.label}</span>
                    <span className="text-sm text-muted-foreground">{style.desc}</span>
                  </button>
                ))}
              </div>

              {/* Language */}
              <div className="space-y-2">
                <p id="page-cap5-cap" className="flex items-center gap-2">
                  <Languages className="icon-sm text-muted-foreground" />
                  {t('Response Language')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('Tap a language. The same setting is in the header globe and in Settings.')}
                </p>
                <LanguageChipGrid
                  value={prefs.responseLanguage}
                  onChange={(v) => {
                    updatePref('responseLanguage', v);
                    applyLocale(v);
                  }}
                />
              </div>

              {/* Use Emoji */}
              <div className="flex items-center justify-between gap-4 py-2">
                <div>
                  <p className="font-medium"><BilingualText en="Use Emojis" el="Χρήση emoji" compact /></p>
                  <p className="text-sm text-muted-foreground">
                    <BilingualText en="Include emojis in AI responses for a friendlier tone" el="Emoji στις απαντήσεις για πιο φιλικό ύφος" wrap />
                  </p>
                </div>
                <Toggle
                  label="Use Emojis"
                  checked={prefs.useEmoji}
                  onChange={(v) => updatePref('useEmoji', v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Feature Toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sliders className="icon-md text-status-success" />
                <BilingualText en="Features" el="Λειτουργίες" compact />
              </CardTitle>
              <CardDescription>
                <BilingualText en="Enable or disable AI assistant features" el="Ενεργοποίηση ή απενεργοποίηση λειτουργιών του βοηθού" wrap />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {[
                { key: 'enableStreaming', label: 'Streaming Responses', desc: 'See AI responses as they are generated' },
                { key: 'enableSuggestions', label: 'Suggested Questions', desc: 'Show quick action suggestions in chat' },
                { key: 'enableContextMemory', label: 'Context Memory', desc: 'AI remembers context from earlier in the conversation' },
                { key: 'enableAutoSave', label: 'Auto-Save Conversations', desc: 'Automatically save your chat history' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                  <Toggle
                    label={label}
                    checked={prefs[key as keyof AIPreferences] as boolean}
                    onChange={(v) => updatePref(key as keyof AIPreferences, v)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Privacy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="icon-md text-status-warning" />
                <BilingualText en="Privacy & Data" el="Απόρρητο & δεδομένα" compact />
              </CardTitle>
              <CardDescription>
                <BilingualText en="Control how your AI conversation data is handled" el="Ελέγξτε πώς χειρίζονται τα δεδομένα των συνομιλιών σας με το AI" wrap />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {[
                { key: 'saveConversations', label: 'Save Conversations', desc: 'Store your AI chat history for future reference' },
                { key: 'anonymizeData', label: 'Anonymize Data', desc: 'Remove personally identifiable information from saved data' },
                { key: 'shareForTraining', label: 'Help Improve AI', desc: 'Allow anonymized conversations to improve the AI (optional)' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                  <Toggle
                    label={label}
                    checked={prefs[key as keyof AIPreferences] as boolean}
                    onChange={(v) => updatePref(key as keyof AIPreferences, v)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Available Agents Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CfbGlyph name="spark" className="icon-md text-muted-foreground" />
                <BilingualText en="Available AI Agents" el="Διαθέσιμοι πράκτορες AI" compact />
              </CardTitle>
              <CardDescription>
                <BilingualText en="Specialized AI assistants for different tasks" el="Εξειδικευμένοι βοηθοί AI για διαφορετικές εργασίες" wrap />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                {(agents.length > 0 ? agents : [
                  { id: 'general', name: 'General Assistant', description: 'Platform help and FAQs' },
                  { id: 'matching', name: 'Co-Founder Matching', description: 'Find the right co-founder' },
                  { id: 'pitch-coach', name: 'Pitch Coach', description: 'Improve your pitch deck' },
                  { id: 'research', name: 'Research Assistant', description: 'Market research & analysis' },
                  { id: 'fundraising', name: 'Fundraising Advisor', description: 'Raise capital effectively' },
                  { id: 'growth-strategist', name: 'Growth Strategist', description: 'Scale your startup' },
                ]).map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-start gap-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <CfbGlyph name="spark" className="icon-sm" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{agent.name}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">{agent.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
