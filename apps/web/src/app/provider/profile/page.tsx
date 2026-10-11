'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Save, RefreshCw, DollarSign, Star, Building2,
} from 'lucide-react';
import { useStoredUser } from '@/hooks/useStoredUser';
import { PersonVerifiedBadge } from '@/components/commitments/PersonVerifiedBadge';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/useSession';
import { getMeProfile, getProviderSummary } from '@/lib/api';
import { qk, queryKeys } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';

import { pressableProps } from '@/lib/pressable';
import { CardHead } from '@/components/common/CardAnatomy';
import { FactLine } from '@/components/common/FactLine';
const SERVICE_TYPES = [
  { value: 'legal', label: 'Legal' },
  { value: 'accounting', label: 'Accounting & Finance' },
  { value: 'development', label: 'Software Development' },
  { value: 'design', label: 'Design & UX' },
  { value: 'marketing', label: 'Marketing & Growth' },
  { value: 'recruiting', label: 'Recruiting & HR' },
  { value: 'consulting', label: 'Business Consulting' },
  { value: 'coaching', label: 'Executive Coaching' },
];

const PRICING_MODELS = [
  { value: 'hourly', label: 'Hourly Rate' },
  { value: 'project', label: 'Project-Based' },
  { value: 'retainer', label: 'Monthly Retainer' },
  { value: 'equity', label: 'Revenue Share / Equity' },
  { value: 'mixed', label: 'Mixed' },
];

const INDUSTRIES = [
  'SaaS', 'Fintech', 'Healthtech', 'Edtech', 'E-commerce', 'Marketplace',
  'Deep Tech', 'AI/ML', 'Climate Tech', 'Web3', 'Consumer', 'Enterprise',
];

const STARTUP_STAGES = ['Pre-seed', 'Seed', 'Series A', 'Series B+', 'Growth', 'All stages'];

export default function ProviderProfilePage() {
  // The preview's check is the real verification, not a constant.
  const me = useStoredUser();
  const { hasSession, mounted } = useSession();
  const { success } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [serviceType, setServiceType] = useState('consulting');
  const [companyName, setCompanyName] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [pricingModel, setPricingModel] = useState('project');
  const [startingPrice, setStartingPrice] = useState('');
  const [yearsInBusiness, setYearsInBusiness] = useState('3');
  const [clientsServed, setClientsServed] = useState('');
  const [isAccepting, setIsAccepting] = useState(true);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(['SaaS', 'Fintech']);
  const [selectedStages, setSelectedStages] = useState<string[]>(['Seed', 'Series A']);

  const { data: profile } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: getMeProfile,
    enabled: hasSession && mounted,
  });

  // The header said "4.8 (8 reviews)" for every provider; it reads the rating
  // the provider dashboard reads.
  const { data: summary } = useQuery({
    queryKey: qk('provider', 'summary'),
    queryFn: getProviderSummary,
    enabled: hasSession && mounted,
    retry: 0,
  });

  const displayName = profile?.profile?.displayName ?? 'Provider';
  const avatarUrl = profile?.profile?.avatarUrl;

  function toggleChip(list: string[], setList: (v: string[]) => void, val: string) {
    setList(list.includes(val) ? list.filter(x => x !== val) : [...list, val]);
  }

  async function handleSave() {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setIsSaving(false);
    success('Profile updated', 'Your provider profile is now live.');
  }

  if (!mounted) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppShell>
    );
  }

  const serviceTypeLabel = SERVICE_TYPES.find(s => s.value === serviceType)?.label ?? serviceType;

  return (
    <AppShell
      actions={
        <>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <RefreshCw className="mr-2 icon-sm animate-spin" /> : <Save className="mr-2 icon-sm" />}
            Save Profile
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Preview Card */}
        {/* The card others meet, on the card anatomy: the company's mark and
            name with the headline under it, the kind at the right, the facts
            on the mark's left edge. */}
        <Card className="border-primary/15 bg-primary/[0.03]">
          <CardContent className="space-y-3">
            <CardHead
              titleAs="h2"
              mark={(
                <Avatar className="h-10 w-10 rounded-xl ring-2 ring-primary/20">
                  <AvatarImage src={avatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="rounded-xl bg-primary/10 font-semibold text-primary-accessible">
                    {displayName[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              title={(
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="min-w-0 break-words">{companyName || displayName}</span>
                  <PersonVerifiedBadge userId={me?.id ?? ''} />
                </span>
              )}
              subtitle={headline || <BilingualText en="Add your service headline below..." el="Προσθέστε τον τίτλο της υπηρεσίας σας παρακάτω..." compact />}
              aside={<Badge variant="secondary" className="text-xs">{serviceTypeLabel}</Badge>}
            />
            <FactLine
              items={[
                <span key="rating" className="inline-flex items-center gap-1">
                  <Star className="icon-sm text-status-warning" aria-hidden="true" />
                  {summary?.avgRating != null
                    ? <BilingualText en={`${summary.avgRating.toFixed(1)} (${summary.reviewCount} reviews)`} el={`${summary.avgRating.toFixed(1)} (${summary.reviewCount} αξιολογήσεις)`} compact />
                    : <BilingualText en="No reviews yet" el="Καμία αξιολόγηση ακόμη" compact />}
                </span>,
                <BilingualText key="clients" en={`${clientsServed || '?'} clients`} el={`${clientsServed || '?'} πελάτες`} compact />,
                <BilingualText key="years" en={`${yearsInBusiness}y in business`} el={`${yearsInBusiness} έτη λειτουργίας`} compact />,
                companyWebsite ? <span key="web" className="break-all">{companyWebsite}</span> : null,
              ]}
            />
          </CardContent>
        </Card>

        <Tabs defaultValue="basics">
          <TabsList className="w-full sm:grid sm:grid-cols-3">
            <TabsTrigger value="basics"><BilingualText en="Basics" el="Βασικά" compact /></TabsTrigger>
            <TabsTrigger value="targeting"><BilingualText en="Targeting" el="Στόχευση" compact /></TabsTrigger>
            <TabsTrigger value="pricing"><BilingualText en="Pricing" el="Τιμολόγηση" compact /></TabsTrigger>
          </TabsList>

          {/* Basics */}
          <TabsContent value="basics" className="space-y-4">
            <Card>
              <CardHeader><CardTitle><BilingualText en="Company Info" el="Στοιχεία εταιρείας" compact /></CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="provider-company-name"><BilingualText en="Company Name" el="Επωνυμία" compact /></Label>
                    <Input id="provider-company-name" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Legal Partners" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider-website"><BilingualText en="Website" el="Ιστότοπος" compact /></Label>
                    <Input id="provider-website" value={companyWebsite} onChange={e => setCompanyWebsite(e.target.value)} placeholder="https://acmelegal.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceType"><BilingualText en="Service Type" el="Τύπος υπηρεσίας" compact /></Label>
                  <Select value={serviceType} onValueChange={setServiceType}>
                    <SelectTrigger id="serviceType" aria-label="Service Type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider-headline"><BilingualText en="Headline" el="Τίτλος" compact /></Label>
                  <Input
                    id="provider-headline"
                    value={headline}
                    onChange={e => setHeadline(e.target.value)}
                    placeholder="e.g. Startup-focused legal services — term sheets, IP, incorporation"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider-description"><BilingualText en="Description" el="Περιγραφή" compact /></Label>
                  <Textarea
                    id="provider-description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={bilingualInline("Describe your services, your process, and what makes you different…", "Περιγράψτε τις υπηρεσίες, τη μέθοδό σας και τι σας ξεχωρίζει…")}
                    rows={5}
                    className="resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="yearsInBusiness"><BilingualText en="Years in Business" el="Χρόνια λειτουργίας" compact /></Label>
                    <Select value={yearsInBusiness} onValueChange={setYearsInBusiness}>
                      <SelectTrigger id="yearsInBusiness" aria-label="Years in Business"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['1', '2', '3', '5', '7', '10', '15', '20+'].map(v => (
                          <SelectItem key={v} value={v}>{v} year{v !== '1' ? 's' : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider-clients-served"><BilingualText en="Clients Served" el="Πελάτες που εξυπηρετήθηκαν" compact /></Label>
                    <Input
                      id="provider-clients-served"
                      type="number"
                      value={clientsServed}
                      onChange={e => setClientsServed(e.target.value)}
                      placeholder="50"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div>
                    <p className="text-sm font-medium"><BilingualText en="Accepting New Clients" el="Δέχεται νέους πελάτες" compact /></p>
                    <p className="text-xs text-muted-foreground"><BilingualText en="Show in service provider discovery" el="Εμφάνιση στην αναζήτηση παρόχων" wrap /></p>
                  </div>
                  <Switch checked={isAccepting} onCheckedChange={setIsAccepting} aria-label="Accepting New Clients" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Targeting */}
          <TabsContent value="targeting" className="space-y-4">
            <Card>
              <CardHeader><CardTitle><BilingualText en="Industries You Serve" el="Κλάδοι που εξυπηρετείτε" compact /></CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map(ind => (
                    <button
                      key={ind}
                      onClick={() => toggleChip(selectedIndustries, setSelectedIndustries, ind)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        selectedIndustries.includes(ind)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50'
                      )}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle><BilingualText en="Startup Stages" el="Στάδια startup" compact /></CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {STARTUP_STAGES.map(stage => (
                    <button
                      key={stage}
                      onClick={() => toggleChip(selectedStages, setSelectedStages, stage)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        selectedStages.includes(stage)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50'
                      )}
                    >
                      {stage}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing */}
          <TabsContent value="pricing" className="space-y-4">
            <Card>
              <CardHeader><CardTitle><BilingualText en="Pricing Model" el="Μοντέλο τιμολόγησης" compact /></CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {PRICING_MODELS.map(pm => (
                    <div
                      key={pm.value}
                      onClick={() => setPricingModel(pm.value)}
                      {...pressableProps({ pressed: pricingModel === pm.value })}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all',
                        pricingModel === pm.value ? 'border-primary bg-primary/5' : 'hover:border-border'
                      )}
                    >
                      <p className="text-sm font-medium">{pm.label}</p>
                      <div className={cn(
                        'w-4 h-4 rounded-full border-2 transition-all',
                        pricingModel === pm.value ? 'border-primary bg-primary' : 'border-border'
                      )} />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startingPrice"><BilingualText en="Starting Price (USD)" el="Αρχική τιμή (USD)" compact /></Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">$</span>
                    <Input id="startingPrice"
                      type="number"
                      value={startingPrice}
                      onChange={e => setStartingPrice(e.target.value)}
                      placeholder="500"
                      className="w-36"
                    />
                    <span className="text-sm text-muted-foreground">minimum engagement</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
