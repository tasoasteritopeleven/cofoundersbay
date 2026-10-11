'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Palette, Type, FileText, Link2, Mail, Tag,
  Eye, Save, Globe, AlertCircle, CheckCircle2,
  Loader2, ExternalLink, Settings, Building2, Image, Camera,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useTenant } from '@/components/providers/TenantContext';
import {
  getTenantBranding,
  updateTenantBranding,
  publishTenantBranding,
  unpublishTenantBranding,
  uploadAvatar,
  type TenantBranding,
} from '@/lib/api';
import { ImageCropperTrigger } from '@/components/ui/image-cropper';
import { analytics } from '@/lib/analytics';
import { qk } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';
import { StatusText } from '@/components/common/StatusText';

// ── Color swatch + input ───────────────────────────────────────────────────────

function ColorField({
  label,
  labelEl,
  value,
  onChange,
  description,
  descriptionEl,
}: {
  label: string;
  labelEl: string;
  value: string;
  onChange: (v: string) => void;
  description?: string;
  descriptionEl?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`color-${label}`}><BilingualText en={label} el={labelEl} compact /></Label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value || '#6756dc'}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
            id={`color-${label}`}
          />
          <label
            htmlFor={`color-${label}`}
            className="block w-10 h-10 rounded-lg border-2 border-border cursor-pointer hover:border-primary/50 transition-colors shadow-sm"
            style={{ backgroundColor: value || '#6756dc' }}
          />
        </div>
        <Input
          aria-label={bilingualAria(`${label} hex code`, `${labelEl}: κωδικός hex`)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#6756dc"
          className="flex-1 font-mono"
          maxLength={7}
        />
      </div>
      {description && <p className="text-xs text-muted-foreground"><BilingualText en={description} el={descriptionEl ?? description} wrap /></p>}
    </div>
  );
}

const GOOGLE_FONTS = [
  'Inter', 'Poppins', 'Roboto', 'Open Sans', 'Lato', 'Nunito',
  'Playfair Display', 'Merriweather', 'Source Serif Pro', 'DM Sans',
  'Plus Jakarta Sans', 'Outfit', 'Raleway', 'Montserrat',
];

const BG_STYLES = [
  { value: 'gradient', label: 'Gradient', labelEl: 'Διαβάθμιση' },
  { value: 'flat', label: 'Flat', labelEl: 'Επίπεδο' },
  { value: 'image', label: 'Hero Image', labelEl: 'Κεντρική εικόνα' },
  { value: 'dark', label: 'Dark', labelEl: 'Σκούρο' },
];

type FormState = Omit<TenantBranding, 'id' | 'tenantId' | 'publishedAt' | 'updatedAt' | 'isBrandingActive'>;

const DEFAULT_FORM: FormState = {
  primaryColor: '#6756dc',
  secondaryColor: '#8b5cf6',
  accentColor: '#22d3ee',
  backgroundStyle: 'gradient',
  headingFont: 'Inter',
  bodyFont: 'Inter',
  logoUrl: '',
  faviconUrl: '',
  heroImageUrl: '',
  websiteUrl: '',
  heroTitle: '',
  heroSubtitle: '',
  aboutText: '',
  ctaLabel: 'Get Started',
  ctaUrl: '',
  onboardingIntroText: '',
  dashboardWelcomeText: '',
  communityNaming: '',
  roleLabels: {},
  supportEmail: '',
  privacyPolicyUrl: '',
  termsUrl: '',
  cookiePolicyUrl: '',
  linkedinUrl: '',
  twitterUrl: '',
  instagramUrl: '',
  websiteFooterUrl: '',
  emailSignature: '',
  emailLogoUrl: '',
  emailFooterText: '',
  emailFromName: '',
};

export default function TenantBrandingPage() {
  const qc = useQueryClient();
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id ?? '';
  const tenantSlug = activeTenant?.slug ?? '';

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saved, setSaved] = useState(false);

  const { data: branding, isLoading } = useQuery({
    queryKey: qk('tenant', 'branding', tenantId),
    queryFn: () => getTenantBranding(tenantId),
    enabled: !!tenantId,
  });

  // Sync remote branding into form once loaded
  useEffect(() => {
    if (!branding) return;
    setForm({
      primaryColor: branding.primaryColor ?? DEFAULT_FORM.primaryColor,
      secondaryColor: branding.secondaryColor ?? DEFAULT_FORM.secondaryColor,
      accentColor: branding.accentColor ?? DEFAULT_FORM.accentColor,
      backgroundStyle: branding.backgroundStyle ?? DEFAULT_FORM.backgroundStyle,
      headingFont: branding.headingFont ?? DEFAULT_FORM.headingFont,
      bodyFont: branding.bodyFont ?? DEFAULT_FORM.bodyFont,
      logoUrl: branding.logoUrl ?? '',
      faviconUrl: branding.faviconUrl ?? '',
      heroImageUrl: branding.heroImageUrl ?? '',
      websiteUrl: branding.websiteUrl ?? '',
      heroTitle: branding.heroTitle ?? '',
      heroSubtitle: branding.heroSubtitle ?? '',
      aboutText: branding.aboutText ?? '',
      ctaLabel: branding.ctaLabel ?? 'Get Started',
      ctaUrl: branding.ctaUrl ?? '',
      onboardingIntroText: branding.onboardingIntroText ?? '',
      dashboardWelcomeText: branding.dashboardWelcomeText ?? '',
      communityNaming: branding.communityNaming ?? '',
      roleLabels: branding.roleLabels ?? {},
      supportEmail: branding.supportEmail ?? '',
      privacyPolicyUrl: branding.privacyPolicyUrl ?? '',
      termsUrl: branding.termsUrl ?? '',
      cookiePolicyUrl: branding.cookiePolicyUrl ?? '',
      linkedinUrl: branding.linkedinUrl ?? '',
      twitterUrl: branding.twitterUrl ?? '',
      instagramUrl: branding.instagramUrl ?? '',
      websiteFooterUrl: branding.websiteFooterUrl ?? '',
      emailSignature: branding.emailSignature ?? '',
      emailLogoUrl: branding.emailLogoUrl ?? '',
      emailFooterText: branding.emailFooterText ?? '',
      emailFromName: branding.emailFromName ?? '',
    });
  }, [branding]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const saveMutation = useMutation({
    mutationFn: (data: FormState) => updateTenantBranding(tenantId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk('tenant', 'branding', tenantId) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      void analytics.track('tenant_branding_updated', {
        tenant_id: tenantId,
        has_logo: !!form.logoUrl,
        has_favicon: !!form.faviconUrl,
        has_custom_colors: !!(form.primaryColor !== DEFAULT_FORM.primaryColor || form.secondaryColor !== DEFAULT_FORM.secondaryColor),
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => publishTenantBranding(tenantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk('tenant', 'branding', tenantId) }),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => unpublishTenantBranding(tenantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk('tenant', 'branding', tenantId) }),
  });

  const handleSave = () => saveMutation.mutate(form);
  const handlePreview = () => {
    if (tenantSlug) window.open(`/t/${tenantSlug}`, '_blank');
  };

  const roleLabels = (form.roleLabels as Record<string, string>) ?? {};
  const setRoleLabel = (role: string, label: string) => {
    setField('roleLabels', { ...roleLabels, [role]: label });
  };

  if (!tenantId) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <div className="text-center space-y-2">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" aria-hidden="true" />
            <p className="text-lg font-medium"><BilingualText en="No organization context" el="Δεν έχει επιλεγεί οργανισμός" compact /></p>
            <p className="text-sm text-muted-foreground"><BilingualText en="You must be a member of an organization to manage branding." el="Πρέπει να είστε μέλος οργανισμού για να διαχειριστείτε την εμφάνιση." wrap /></p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Branding"
      description="Customize colors, logos, fonts, and landing page copy. Work in draft, then publish to apply across your tenant."
      showHelp
      actions={(
        <>
          {branding?.isBrandingActive ? (
            <Badge variant="default" className="gap-1.5 bg-status-success-mark hover:bg-status-success-mark">
              <CheckCircle2 className="icon-sm" />
              <BilingualText en="Published" el="Δημοσιευμένο" compact />
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1.5">
              <AlertCircle className="icon-sm" />
              <BilingualText en="Draft" el="Πρόχειρο" compact />
            </Badge>
          )}
          {tenantSlug && (
            <Button variant="outline" size="sm" onClick={handlePreview}>
              <Eye className="mr-1.5 icon-sm" />
              <BilingualText en="Preview" el="Προεπισκόπηση" compact />
              <ExternalLink className="ml-1.5 icon-sm opacity-60" />
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-1.5 icon-sm animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="mr-1.5 icon-sm" />
            ) : (
              <Save className="mr-1.5 icon-sm" />
            )}
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </>
      )}
    >
      <div className="space-y-6 max-w-5xl">

        {saveMutation.isError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-accessible">
            <AlertCircle className="icon-sm shrink-0" />
            <BilingualText en="Failed to save changes. Please try again." el="Οι αλλαγές δεν αποθηκεύτηκαν. Δοκιμάστε ξανά." wrap />
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="icon-xl animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="colors" className="space-y-6">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="colors"><Palette className="mr-1.5 icon-sm" /><BilingualText en="Colors" el="Χρώματα" compact /></TabsTrigger>
              <TabsTrigger value="typography"><Type className="mr-1.5 icon-sm" /><BilingualText en="Typography" el="Τυπογραφία" compact /></TabsTrigger>
              <TabsTrigger value="assets"><Image className="mr-1.5 h-3.5 w-3.5" /><BilingualText en="Assets" el="Αρχεία" compact /></TabsTrigger>
              <TabsTrigger value="content"><FileText className="mr-1.5 icon-sm" /><BilingualText en="Content" el="Περιεχόμενο" compact /></TabsTrigger>
              <TabsTrigger value="labels"><Tag className="mr-1.5 icon-sm" /><BilingualText en="Labels" el="Ετικέτες" compact /></TabsTrigger>
              <TabsTrigger value="legal"><Globe className="mr-1.5 icon-sm" /><BilingualText en="Legal & Social" el="Νομικά & κοινωνικά" compact /></TabsTrigger>
              <TabsTrigger value="email"><Mail className="mr-1.5 icon-sm" /><BilingualText en="Email" el="Email" compact /></TabsTrigger>
              <TabsTrigger value="publish"><Settings className="mr-1.5 icon-sm" /><BilingualText en="Publish" el="Δημοσίευση" compact /></TabsTrigger>
            </TabsList>

            {/* ── Colors ── */}
            <TabsContent value="colors" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle><BilingualText en="Brand Colors" el="Χρώματα ταυτότητας" compact /></CardTitle>
                  <CardDescription><BilingualText en="Define your organization's color palette. These are applied as CSS variables throughout the platform." el="Ορίστε την παλέτα του οργανισμού σας. Εφαρμόζεται ως μεταβλητές CSS σε όλη την πλατφόρμα." wrap /></CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                    <ColorField
                      label="Primary Color"
                      labelEl="Κύριο χρώμα"
                      value={form.primaryColor ?? '#6756dc'}
                      onChange={(v) => setField('primaryColor', v)}
                      description="Buttons, links, accents"
                      descriptionEl="Κουμπιά, σύνδεσμοι, εμφάσεις"
                    />
                    <ColorField
                      label="Secondary Color"
                      labelEl="Δευτερεύον χρώμα"
                      value={form.secondaryColor ?? '#8b5cf6'}
                      onChange={(v) => setField('secondaryColor', v)}
                      description="Secondary actions, hover states"
                      descriptionEl="Δευτερεύουσες ενέργειες, καταστάσεις hover"
                    />
                    <ColorField
                      label="Accent Color"
                      labelEl="Χρώμα έμφασης"
                      value={form.accentColor ?? '#22d3ee'}
                      onChange={(v) => setField('accentColor', v)}
                      description="Highlights, badges, tags"
                      descriptionEl="Επισημάνσεις, σήματα, ετικέτες"
                    />
                  </div>

                  <div className="space-y-2">
                    <p id="page-cap1-cap" className="text-sm font-medium"><BilingualText en="Background Style" el="Στυλ φόντου" compact /></p>
                    <div role="group" aria-labelledby="page-cap1-cap" className="flex flex-wrap gap-2">
                      {BG_STYLES.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setField('backgroundStyle', s.value)}
                          aria-pressed={form.backgroundStyle === s.value}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            form.backgroundStyle === s.value
                              ? 'border-primary bg-primary/10 text-primary-accessible'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <BilingualText en={s.label} el={s.labelEl} compact />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border p-5 space-y-3">
                    <p className="text-sm font-medium text-muted-foreground"><BilingualText en="Live Preview" el="Ζωντανή προεπισκόπηση" compact /></p>
                    {/* A picture of three buttons, not three controls: inert
                        takes them out of the tab order and the a11y tree, and
                        tabIndex -1 says the same to the dead-control guard. */}
                    <div className="flex flex-wrap gap-2" inert>
                      <Button tabIndex={-1} style={{ backgroundColor: form.primaryColor ?? undefined }}><BilingualText en="Primary" el="Κύριο" compact /></Button>
                      <Button
                        tabIndex={-1}
                        variant="outline"
                        style={{
                          borderColor: form.secondaryColor ?? undefined,
                          color: form.secondaryColor ?? undefined,
                        }}
                      >
                        <BilingualText en="Secondary" el="Δευτερεύον" compact />
                      </Button>
                      <Button tabIndex={-1} variant="ghost" style={{ color: form.accentColor ?? undefined }}>
                        <BilingualText en="Accent" el="Έμφαση" compact />
                      </Button>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <div className="h-6 w-16 rounded" style={{ backgroundColor: form.primaryColor ?? '#6756dc' }} />
                      <div className="h-6 w-16 rounded" style={{ backgroundColor: form.secondaryColor ?? '#8b5cf6' }} />
                      <div className="h-6 w-16 rounded" style={{ backgroundColor: form.accentColor ?? '#22d3ee' }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Typography ── */}
            <TabsContent value="typography" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle><BilingualText en="Typography" el="Τυπογραφία" compact /></CardTitle>
                  <CardDescription><BilingualText en="Choose Google Fonts for headings and body text. They are loaded dynamically per tenant." el="Επιλέξτε Google Fonts για τίτλους και κείμενο. Φορτώνονται δυναμικά ανά οργανισμό." wrap /></CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {(['headingFont', 'bodyFont'] as const).map((key) => (
                    <div key={key} className="space-y-2">
                      <p id={`page-cap2-${key}`} className="text-sm font-medium">
                        {key === 'headingFont'
                          ? <BilingualText en="Heading Font" el="Γραμματοσειρά τίτλων" compact />
                          : <BilingualText en="Body Font" el="Γραμματοσειρά κειμένου" compact />}
                      </p>
                      <div role="group" aria-labelledby={`page-cap2-${key}`} className="flex flex-wrap gap-2">
                        {GOOGLE_FONTS.map((font) => (
                          <button
                            key={font}
                            type="button"
                            onClick={() => setField(key, font)}
                            aria-pressed={form[key] === font}
                            className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                              form[key] === font
                                ? 'border-primary bg-primary/10 text-primary-accessible font-medium'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            {font}
                          </button>
                        ))}
                      </div>
                      <Input
                        value={form[key] ?? ''}
                        onChange={(e) => setField(key, e.target.value)}
                        aria-labelledby={`page-cap2-${key}`}
                        placeholder={bilingualInline("Custom font name…", "Όνομα προσαρμοσμένης γραμματοσειράς…")}
                        className="mt-2 max-w-sm"
                      />
                    </div>
                  ))}
                  <div className="rounded-lg border p-5">
                    <p className="text-xs text-muted-foreground mb-3"><BilingualText en="Preview" el="Προεπισκόπηση" compact /></p>
                    {/* The faces, previewed a step under the card's own title:
                        a preview never sits level with the section's heading. */}
                    <p className="mb-1 text-sm font-semibold" style={{ fontFamily: form.headingFont ?? 'Inter' }}>
                      {activeTenant?.displayName ?? activeTenant?.name ?? <BilingualText en="Organization Name" el="Όνομα οργανισμού" compact />}
                    </p>
                    <p className="card-body text-muted-foreground" style={{ fontFamily: form.bodyFont ?? 'Inter' }}>
                      <BilingualText en="Empowering founders to build the future. Your mission starts here." el="Δίνουμε δύναμη στους ιδρυτές να χτίσουν το μέλλον. Η αποστολή σας ξεκινά εδώ." wrap />
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Assets ── */}
            <TabsContent value="assets" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle><BilingualText en="Media Assets" el="Αρχεία πολυμέσων" compact /></CardTitle>
                  <CardDescription><BilingualText en="Provide URLs for your logo, favicon, and hero image. Use a CDN or image hosting service." el="Δώστε URL για το λογότυπο, το favicon και την κεντρική εικόνα. Χρησιμοποιήστε CDN ή υπηρεσία φιλοξενίας εικόνων." wrap /></CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Logo Upload */}
                  <div className="space-y-3">
                    <p id="page-cap3-cap" className="text-sm font-medium"><BilingualText en="Organization Logo" el="Λογότυπο οργανισμού" compact /></p>
                    <div role="group" aria-labelledby="page-cap3-cap" className="flex items-start gap-4">
                      <ImageCropperTrigger
                        cropShape="rect"
                        aspectRatio={2}
                        outputSize={400}
                        title="Crop Organization Logo"
                        onCrop={async (blob, dataUrl) => {
                          try {
                            const file = new File([blob], 'logo.png', { type: 'image/png' });
                            const { upload } = await uploadAvatar(file);
                            setField('logoUrl', upload.url);
                          } catch {
                            // Handle error silently or show toast
                          }
                        }}
                      >
                        <div className="relative group cursor-pointer">
                          {form.logoUrl ? (
                            <img
                              src={form.logoUrl}
                              alt="Logo preview"
                              className="h-16 w-32 rounded-lg border border-border object-contain bg-background/50"
                            />
                          ) : (
                            <div data-keep-icon="" className="h-16 w-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/20">
                              <Image className="icon-lg text-muted-foreground" aria-hidden="true" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <Camera className="icon-lg text-white" />
                          </div>
                        </div>
                      </ImageCropperTrigger>
                      <div className="flex-1">
                        <Input
                          aria-labelledby="page-cap3-cap"
                          value={form.logoUrl ?? ''}
                          onChange={(e) => setField('logoUrl', e.target.value)}
                          placeholder="https://..."
                          className="mb-1"
                        />
                        <p className="text-xs text-muted-foreground"><BilingualText en="Click to crop & upload, or paste URL. Recommended: 400×200px, transparent PNG." el="Πατήστε για περικοπή & μεταφόρτωση ή επικολλήστε URL. Προτείνεται: 400×200px, διαφανές PNG." wrap /></p>
                      </div>
                    </div>
                  </div>

                  {/* Favicon Upload */}
                  <div className="space-y-3">
                    <p id="page-cap4-cap" className="text-sm font-medium"><BilingualText en="Favicon" el="Favicon" compact /></p>
                    {/* The hint runs under the whole row, on the card's axis:
                        beside a 32px preview it started a line of its own,
                        indented past the preview. */}
                    <div role="group" aria-labelledby="page-cap4-cap" className="space-y-1">
                      <div className="flex items-center gap-4">
                        <ImageCropperTrigger
                          cropShape="circle"
                          aspectRatio={1}
                          outputSize={64}
                          title="Crop Favicon"
                          onCrop={async (blob, dataUrl) => {
                            try {
                              const file = new File([blob], 'favicon.ico', { type: 'image/png' });
                              const { upload } = await uploadAvatar(file);
                              setField('faviconUrl', upload.url);
                            } catch {
                              // Handle error silently or show toast
                            }
                          }}
                        >
                          <div className="relative group cursor-pointer">
                            {form.faviconUrl ? (
                              <img
                                src={form.faviconUrl}
                                alt="Favicon preview"
                                className="h-8 w-8 rounded-md border border-border object-contain bg-background/50"
                              />
                            ) : (
                              <div data-keep-icon="" className="h-8 w-8 rounded-md border-2 border-dashed border-border flex items-center justify-center bg-muted/20">
                                <Image className="icon-2xs text-muted-foreground" aria-hidden="true" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/60 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <Camera className="icon-sm text-white" />
                            </div>
                          </div>
                        </ImageCropperTrigger>
                        <div className="flex-1">
                          <Input
                            aria-labelledby="page-cap4-cap"
                            value={form.faviconUrl ?? ''}
                            onChange={(e) => setField('faviconUrl', e.target.value)}
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground"><BilingualText en="Click to crop & upload, or paste URL. 64×64px, square format." el="Πατήστε για περικοπή & μεταφόρτωση ή επικολλήστε URL. 64×64px, τετράγωνο." wrap /></p>
                    </div>
                  </div>

                  {[
                    { key: 'heroImageUrl' as const, label: 'Hero / Banner Image URL', labelEl: 'URL κεντρικής εικόνας / banner', hint: 'Displayed on the public landing page. Recommended: 1920×1080px.', hintEl: 'Εμφανίζεται στη δημόσια σελίδα. Προτείνεται: 1920×1080px.' },
                    { key: 'emailLogoUrl' as const, label: 'Email Logo URL', labelEl: 'URL λογοτύπου email', hint: 'Shown in email headers. Transparent PNG recommended.', hintEl: 'Εμφανίζεται στην κεφαλίδα των email. Προτείνεται διαφανές PNG.' },
                  ].map(({ key, label, labelEl, hint, hintEl }) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={`page-f5-${key}`}><BilingualText en={label} el={labelEl} compact /></Label>
                      <Input id={`page-f5-${key}`}
                        value={form[key] ?? ''}
                        onChange={(e) => setField(key, e.target.value)}
                        placeholder="https://..."
                      />
                      <p className="text-xs text-muted-foreground"><BilingualText en={hint} el={hintEl} wrap /></p>
                      {form[key] && (
                        <img
                          src={form[key] as string}
                          alt="Preview"
                          className="mt-2 max-h-24 rounded-lg border object-contain"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Content ── */}
            <TabsContent value="content" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle><BilingualText en="Landing Page Content" el="Περιεχόμενο αρχικής σελίδας" compact /></CardTitle>
                  <CardDescription>Text shown on the public tenant landing page at /t/{'{slug}'}.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="page-f6"><BilingualText en="Hero Title" el="Κεντρικός τίτλος" compact /></Label>
                      <Input id="page-f6"
                        value={form.heroTitle ?? ''}
                        onChange={(e) => setField('heroTitle', e.target.value)}
                        placeholder="Your next co-founder is waiting"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="page-f7"><BilingualText en="Hero Subtitle" el="Κεντρικός υπότιτλος" compact /></Label>
                      <Input id="page-f7"
                        value={form.heroSubtitle ?? ''}
                        onChange={(e) => setField('heroSubtitle', e.target.value)}
                        placeholder="Build, connect, grow with your community"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="page-f8"><BilingualText en="CTA Button Label" el="Κείμενο κουμπιού δράσης" compact /></Label>
                      <Input id="page-f8"
                        value={form.ctaLabel ?? ''}
                        onChange={(e) => setField('ctaLabel', e.target.value)}
                        placeholder="Get Started"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="page-f9"><BilingualText en="CTA Button URL" el="URL κουμπιού δράσης" compact /></Label>
                      <Input id="page-f9"
                        value={form.ctaUrl ?? ''}
                        onChange={(e) => setField('ctaUrl', e.target.value)}
                        placeholder="/register"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="page-f10"><BilingualText en="About Text" el="Κείμενο «Σχετικά»" compact /></Label>
                    <Textarea id="page-f10"
                      rows={4}
                      value={form.aboutText ?? ''}
                      onChange={(e) => setField('aboutText', e.target.value)}
                      placeholder={bilingualInline("Long-form description shown on your public landing page…", "Αναλυτική περιγραφή για τη δημόσια σελίδα σας…")}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle><BilingualText en="Platform Copy" el="Κείμενα πλατφόρμας" compact /></CardTitle>
                  <CardDescription><BilingualText en="Customized text inside the platform for your members." el="Προσαρμοσμένα κείμενα μέσα στην πλατφόρμα για τα μέλη σας." wrap /></CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="page-f11"><BilingualText en="Dashboard Welcome Message" el="Μήνυμα καλωσορίσματος" compact /></Label>
                    <Input id="page-f11"
                      value={form.dashboardWelcomeText ?? ''}
                      onChange={(e) => setField('dashboardWelcomeText', e.target.value)}
                      placeholder="Welcome back! Continue building your network."
                    />
                    <p className="text-xs text-muted-foreground"><BilingualText en="Shown on login page and dashboard header." el="Εμφανίζεται στη σύνδεση και στην κεφαλίδα του πίνακα." wrap /></p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="page-f12"><BilingualText en="Onboarding Introduction" el="Εισαγωγή ένταξης" compact /></Label>
                    <Textarea id="page-f12"
                      rows={3}
                      value={form.onboardingIntroText ?? ''}
                      onChange={(e) => setField('onboardingIntroText', e.target.value)}
                      placeholder="Welcome to [Organization]! Let's set up your profile..."
                    />
                    <p className="text-xs text-muted-foreground"><BilingualText en="Displayed at the start of the onboarding flow." el="Εμφανίζεται στην αρχή της ένταξης." wrap /></p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Labels ── */}
            <TabsContent value="labels" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle><BilingualText en="Custom Naming" el="Προσαρμοσμένη ονοματολογία" compact /></CardTitle>
                  <CardDescription><BilingualText en="Override default platform terminology with organization-specific language." el="Αντικαταστήστε την ορολογία της πλατφόρμας με τη δική σας." wrap /></CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="page-f13"><BilingualText en="Community Naming" el="Όνομα κοινότητας" compact /></Label>
                    <Input id="page-f13"
                      value={form.communityNaming ?? ''}
                      onChange={(e) => setField('communityNaming', e.target.value)}
                      placeholder={bilingualInline("Community (default)", "Κοινότητα (προεπιλογή)")}
                    />
                    <p className="text-xs text-muted-foreground"><BilingualText en={'Replace "Community" with e.g. "Program", "Cohort", "Circle".'} el="Αντικαταστήστε το «Κοινότητα» με π.χ. «Πρόγραμμα», «Κύκλος», «Ομάδα»." wrap /></p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle><BilingualText en="Role Labels" el="Ετικέτες ρόλων" compact /></CardTitle>
                  <CardDescription><BilingualText en="Customize how user roles are displayed to your members." el="Προσαρμόστε πώς εμφανίζονται οι ρόλοι στα μέλη σας." wrap /></CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { role: 'founder', default: 'Founder' },
                    { role: 'investor', default: 'Investor' },
                    { role: 'mentor', default: 'Mentor' },
                    { role: 'member', default: 'Member' },
                  ].map(({ role, default: def }) => (
                    <div key={role} className="flex items-center gap-3">
                      <span id={`role-label-${role}`} className="w-20 text-sm text-muted-foreground"><StatusText value={role} /></span>
                      <span className="text-muted-foreground" aria-hidden="true">→</span>
                      <Input
                        aria-labelledby={`role-label-${role}`}
                        className="flex-1 max-w-xs"
                        value={roleLabels[role] ?? ''}
                        onChange={(e) => setRoleLabel(role, e.target.value)}
                        placeholder={def}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Legal & Social ── */}
            <TabsContent value="legal" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle><BilingualText en="Contact & Legal" el="Επικοινωνία & νομικά" compact /></CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {[
                      { key: 'supportEmail' as const, label: 'Support Email', labelEl: 'Email υποστήριξης', placeholder: 'support@yourorg.com', type: 'email' },
                      { key: 'websiteUrl' as const, label: 'Organization Website', labelEl: 'Ιστότοπος οργανισμού', placeholder: 'https://yourorg.com', type: 'url' },
                      { key: 'privacyPolicyUrl' as const, label: 'Privacy Policy URL', labelEl: 'URL πολιτικής απορρήτου', placeholder: 'https://...', type: 'url' },
                      { key: 'termsUrl' as const, label: 'Terms of Service URL', labelEl: 'URL όρων χρήσης', placeholder: 'https://...', type: 'url' },
                      { key: 'cookiePolicyUrl' as const, label: 'Cookie Policy URL', labelEl: 'URL πολιτικής cookies', placeholder: 'https://...', type: 'url' },
                    ].map(({ key, label, labelEl, placeholder }) => (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={`page-f14-${key}`}><BilingualText en={label} el={labelEl} compact /></Label>
                        <Input id={`page-f14-${key}`}
                          value={form[key] ?? ''}
                          onChange={(e) => setField(key, e.target.value)}
                          placeholder={placeholder}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle><BilingualText en="Social Links" el="Κοινωνικά δίκτυα" compact /></CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {[
                      { key: 'linkedinUrl' as const, label: 'LinkedIn', labelEl: 'LinkedIn', placeholder: 'https://linkedin.com/company/...' },
                      { key: 'twitterUrl' as const, label: 'Twitter / X', labelEl: 'Twitter / X', placeholder: 'https://twitter.com/...' },
                      { key: 'instagramUrl' as const, label: 'Instagram', labelEl: 'Instagram', placeholder: 'https://instagram.com/...' },
                      { key: 'websiteFooterUrl' as const, label: 'Footer Website', labelEl: 'Ιστότοπος υποσέλιδου', placeholder: 'https://...' },
                    ].map(({ key, label, labelEl, placeholder }) => (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={`page-f15-${key}`}><BilingualText en={label} el={labelEl} compact /></Label>
                        <div className="flex items-center gap-2">
                          <Link2 className="icon-sm text-muted-foreground shrink-0" />
                          <Input id={`page-f15-${key}`}
                            value={form[key] ?? ''}
                            onChange={(e) => setField(key, e.target.value)}
                            placeholder={placeholder}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Email ── */}
            <TabsContent value="email" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle><BilingualText en="Email Branding" el="Εμφάνιση email" compact /></CardTitle>
                  <CardDescription><BilingualText en="Customize how your organization appears in outgoing emails." el="Προσαρμόστε πώς εμφανίζεται ο οργανισμός σας στα εξερχόμενα email." wrap /></CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="page-f16"><BilingualText en="Sender Name" el="Όνομα αποστολέα" compact /></Label>
                      <Input id="page-f16"
                        value={form.emailFromName ?? ''}
                        onChange={(e) => setField('emailFromName', e.target.value)}
                        placeholder="TechHub Accelerator"
                      />
                      <p className="text-xs text-muted-foreground"><BilingualText en={'Shown as "From" in emails.'} el="Εμφανίζεται ως «Από» στα email." wrap /></p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="page-f17"><BilingualText en="Email Logo URL" el="URL λογοτύπου email" compact /></Label>
                      <Input id="page-f17"
                        value={form.emailLogoUrl ?? ''}
                        onChange={(e) => setField('emailLogoUrl', e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="page-f18"><BilingualText en="Email Footer Text" el="Κείμενο υποσέλιδου email" compact /></Label>
                    <Textarea id="page-f18"
                      rows={2}
                      value={form.emailFooterText ?? ''}
                      onChange={(e) => setField('emailFooterText', e.target.value)}
                      placeholder="© 2025 TechHub Accelerator. Powered by CoFounderBay."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="page-f19"><BilingualText en="Email Signature" el="Υπογραφή email" compact /></Label>
                    <Textarea id="page-f19"
                      rows={3}
                      value={form.emailSignature ?? ''}
                      onChange={(e) => setField('emailSignature', e.target.value)}
                      placeholder="The TechHub Accelerator Team&#10;support@techhub.com | techhub.com"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Publish ── */}
            <TabsContent value="publish" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle><BilingualText en="Publish Branding" el="Δημοσίευση εμφάνισης" compact /></CardTitle>
                  <CardDescription>
                    <BilingualText en="When active, your branding is applied to all members who access the platform through your organization." el="Όταν είναι ενεργή, η εμφάνισή σας εφαρμόζεται σε όλα τα μέλη που μπαίνουν μέσω του οργανισμού σας." wrap />
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* The status is a setting row of the card, not a box in it. */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium"><BilingualText en="Branding Status" el="Κατάσταση εμφάνισης" compact /></p>
                      <p className="text-xs text-muted-foreground">
                        {branding?.isBrandingActive
                          ? (branding.publishedAt
                            ? <BilingualText en={`Published on ${new Date(branding.publishedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}`} el={`Δημοσιεύτηκε στις ${new Date(branding.publishedAt).toLocaleDateString('el-GR', { timeZone: 'UTC' })}`} compact />
                            : <BilingualText en="Published" el="Δημοσιευμένη" compact />)
                          : <BilingualText en="Not yet published — save changes first, then publish." el="Δεν έχει δημοσιευτεί — αποθηκεύστε πρώτα και μετά δημοσιεύστε." wrap />}
                      </p>
                    </div>
                    <Switch
                      aria-label={bilingualAria('Branding Status', 'Κατάσταση εμφάνισης')}
                      checked={branding?.isBrandingActive ?? false}
                      onCheckedChange={(checked) => {
                        if (checked) publishMutation.mutate();
                        else unpublishMutation.mutate();
                      }}
                      disabled={publishMutation.isPending || unpublishMutation.isPending}
                    />
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium"><BilingualText en="Safeguards" el="Δικλίδες" compact /></p>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className={`icon-sm ${form.primaryColor ? 'text-status-success' : 'text-muted-foreground'}`} />
                        <BilingualText en="Primary color defined" el="Ορίστηκε κύριο χρώμα" compact />
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className={`icon-sm ${form.heroTitle ? 'text-status-success' : 'text-muted-foreground'}`} />
                        <BilingualText en="Hero title set" el="Ορίστηκε κεντρικός τίτλος" compact />
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className={`icon-sm ${form.supportEmail ? 'text-status-success' : 'text-muted-foreground'}`} />
                        <BilingualText en="Support email configured" el="Ορίστηκε email υποστήριξης" compact />
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className={`icon-sm ${form.privacyPolicyUrl && form.termsUrl ? 'text-status-success' : 'text-muted-foreground'}`} />
                        <BilingualText en="Legal links provided" el="Δόθηκαν νομικοί σύνδεσμοι" compact />
                      </li>
                    </ul>
                  </div>

                  {tenantSlug && (
                    <Button variant="outline" className="w-full" onClick={handlePreview}>
                      <Eye className="mr-2 icon-sm" />
                      <BilingualText en="Preview Public Landing Page" el="Προεπισκόπηση δημόσιας σελίδας" compact />
                      <ExternalLink className="ml-2 icon-sm opacity-60" />
                    </Button>
                  )}

                  <div className="flex gap-3">
                    <Button className="flex-1" onClick={handleSave} disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? (
                        <Loader2 className="mr-2 icon-sm animate-spin" />
                      ) : (
                        <Save className="mr-2 icon-sm" />
                      )}
                      <BilingualText en="Save Draft" el="Αποθήκευση πρόχειρου" compact />
                    </Button>
                    {!branding?.isBrandingActive && (
                      <Button
                        variant="default"
                        className="flex-1 bg-status-success-mark hover:bg-status-success-mark"
                        onClick={() => { saveMutation.mutate(form); publishMutation.mutate(); }}
                        disabled={saveMutation.isPending || publishMutation.isPending}
                      >
                        <CheckCircle2 className="mr-2 icon-sm" />
                        <BilingualText en="Save & Publish" el="Αποθήκευση & δημοσίευση" compact />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}
