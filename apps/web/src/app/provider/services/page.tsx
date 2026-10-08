'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Store,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Banknote,
  Clock,
  Star,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { listMyMarketplaceServices, createMarketplaceService, updateMarketplaceService, deleteMarketplaceService, type MarketplaceServiceItem } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/common/EmptyState';
import { useDemoData } from '@/contexts/DemoDataContext';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { CANCELLED, ROW_GONE, rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { bilingualAria } from '@/lib/i18n/format';
import { StatusText } from '@/components/common/StatusText';

type Service = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: string;
  priceType: 'fixed' | 'hourly' | 'custom';
  deliveryTime: string;
  isActive: boolean;
  bookings: number;
  rating: number;
  reviews: number;
};

type ServiceActions = {
  /** All absent on demo rows: there is no listing behind them. */
  onActive?: (s: Service, active: boolean) => Promise<PageControlRunResult>;
  onEdit?: (s: Service) => void;
  onDelete?: (s: Service) => Promise<PageControlRunResult>;
};

function ServiceCard({ service, onActive, onEdit, onDelete }: { service: Service } & ServiceActions) {
  const [isActive, setIsActive] = useState(service.isActive);
  // Follow the listing when it changes from elsewhere - a refetch after the
  // assistant publishes or hides it - rather than keeping the first value.
  useEffect(() => setIsActive(service.isActive), [service.isActive]);
  // The switch moved local state and nothing else. On a live listing it now
  // writes isActive through PATCH /marketplace/:id.
  const toggleActive = (next: boolean) => {
    setIsActive(next);
    onActive?.(service, next);
  };

  return (
    <Card className={cn('transition-all', !isActive && 'surface-inactive')}>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{service.name}</h3>
              <Badge variant={isActive ? 'default' : 'secondary'}>
                {isActive ? <BilingualText en="Active" el="Ενεργή" compact /> : <BilingualText en="Inactive" el="Ανενεργή" compact />}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {service.description}
            </p>
            <div className="flex flex-wrap gap-3 mt-3 text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Banknote className="icon-sm" aria-hidden="true" />
                {service.price}
                {service.priceType === 'hourly' && <BilingualText en="/hr" el="/ώρα" compact />}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="icon-sm" />
                {service.deliveryTime}
              </span>
              {/*
                * Shown only where there is a rating. The marketplace is a
                * directory of listings, not a booking system, so a real
                * listing has none — and "0 (0)" would read as nobody liking it
                * rather than as nobody having rated it.
                */}
              {service.reviews > 0 ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Star className="icon-sm fill-status-warning text-status-warning" />
                  {service.rating} ({service.reviews})
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <Badge variant="outline"><StatusText value={service.category} /></Badge>
              {service.bookings > 0 ? (
                <span className="text-xs text-muted-foreground">
                  <BilingualText en={`${service.bookings} bookings`} el={`${service.bookings} κρατήσεις`} compact />
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground" aria-hidden="true">
                {isActive ? <BilingualText en="Active" el="Ενεργή" compact /> : <BilingualText en="Inactive" el="Ανενεργή" compact />}
              </span>
              <Switch checked={isActive} onCheckedChange={toggleActive} aria-label={bilingualAria(`Active: ${service.name}`, `Ενεργή: ${service.name}`)} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Open actions for ${service.name}`}>
                  <MoreVertical className="icon-sm" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* All three had no handler. PATCH and DELETE /marketplace/:id
                    exist (owner-only, enforced by the service); the public
                    listing is the marketplace searched for this title. */}
                <DropdownMenuItem disabled={!onEdit} onSelect={() => onEdit?.(service)}>
                  <Edit className="mr-2 icon-sm" aria-hidden="true" />
                  <BilingualText en="Edit Service" el="Επεξεργασία υπηρεσίας" compact />
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/marketplace?q=${encodeURIComponent(service.name)}`}>
                    <Eye className="mr-2 icon-sm" aria-hidden="true" />
                    <BilingualText en="Preview" el="Προεπισκόπηση" compact />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive-accessible" disabled={!onDelete} onSelect={() => onDelete?.(service)}>
                  <Trash2 className="mr-2 icon-sm" aria-hidden="true" />
                  <BilingualText en="Delete" el="Διαγραφή" compact />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The page's own row from the marketplace listing.
 *
 * `createdById` has been on `MarketplaceService` all along and nothing
 * filtered by it, so a provider had no way to see what they had published.
 * `/api/marketplace/mine` is that filter.
 *
 * Bookings, rating and review count have no source: the marketplace is a
 * directory of listings, not a booking system. They read as absent rather
 * than as zero, which would claim nobody had booked.
 */
function toPageService(item: MarketplaceServiceItem): Service {
  return {
    id: item.id,
    name: item.title,
    description: item.description ?? '',
    category: item.category,
    price: item.pricing ?? '—',
    priceType: 'custom',
    deliveryTime: '—',
    isActive: item.isActive ?? true,
    bookings: 0,
    rating: 0,
    reviews: 0,
  };
}

/** Shown to a provider who has published nothing yet. */
const MOCK_SERVICES: Service[] = [
    {
      id: '1',
      name: 'Startup Legal Package',
      description: 'Complete legal setup for startups including incorporation, founder agreements, and IP protection.',
      category: 'Legal',
      price: '€2,500',
      priceType: 'fixed',
      deliveryTime: '2 weeks',
      isActive: true,
      bookings: 24,
      rating: 4.9,
      reviews: 18,
    },
    {
      id: '2',
      name: 'Financial Model Creation',
      description: 'Professional financial model for fundraising with 3-5 year projections and scenario analysis.',
      category: 'Finance',
      price: '€1,200',
      priceType: 'fixed',
      deliveryTime: '1 week',
      isActive: true,
      bookings: 15,
      rating: 4.8,
      reviews: 12,
    },
    {
      id: '3',
      name: 'Contract Review',
      description: 'Review and markup of any business contract with legal recommendations.',
      category: 'Legal',
      price: '€150',
      priceType: 'hourly',
      deliveryTime: '48 hours',
      isActive: true,
      bookings: 42,
      rating: 4.7,
      reviews: 35,
    },
    {
      id: '4',
      name: 'Pitch Deck Design',
      description: 'Professional pitch deck design with compelling visuals and storytelling.',
      category: 'Design',
      price: '$800',
      priceType: 'fixed',
      deliveryTime: '5 days',
      isActive: false,
      bookings: 8,
      rating: 4.6,
      reviews: 6,
    },
  ];

export default function ProviderServicesPage() {
  const { showDemoData } = useDemoData();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: qk('provider', 'services'),
    queryFn: () => listMyMarketplaceServices({ limit: 50 }),
    staleTime: 60_000,
    retry: 0,
  });

  const live = useMemo(() => (data?.services ?? []).map(toPageService), [data]);
  const services = live.length > 0 ? live : isLoading ? [] : showDemoData ? MOCK_SERVICES : [];
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Service | null>(null);
  const [draft, setDraft] = useState({ title: '', description: '', pricing: '', providerName: '' });
  // "Add Service" (header and empty state) had no handler; the same dialog
  // creates a listing through POST /marketplace.
  const [creating, setCreating] = useState(false);
  const openCreate = () => {
    setDraft({ title: '', description: '', pricing: '', providerName: '' });
    setCreating(true);
  };
  const [saving, setSaving] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: qk('provider', 'services') });

  const serviceActions: ServiceActions = live.length > 0 ? {
    onActive: async (svc, active) => {
      try {
        await updateMarketplaceService(svc.id, { isActive: active });
        success(active ? 'Listing is live' : 'Listing hidden', svc.name);
      } catch (e) {
        toastError('Could not change the listing', e instanceof Error ? e.message : undefined);
        return { error: e instanceof Error && e.message ? e.message : 'The listing did not change.' };
      } finally { refresh(); }
    },
    onEdit: (svc) => {
      setDraft({ title: svc.name, description: svc.description, pricing: svc.price === '\u2014' ? '' : svc.price, providerName: '' });
      setEditing(svc);
    },
    onDelete: async (svc) => {
      const ok = await confirm({
        title: <BilingualText en={`Delete ${svc.name}?`} el={`Διαγραφή: ${svc.name};`} />,
        description: <BilingualText en="The listing leaves the marketplace. Past inquiries keep their history." el="Η καταχώριση αφαιρείται από τον κατάλογο υπηρεσιών. Τα παλαιότερα αιτήματα κρατούν το ιστορικό τους." />,
        confirmLabel: <BilingualText en="Delete listing" el="Διαγραφή καταχώρισης" compact />,
      });
      if (!ok) return CANCELLED;
      try {
        await deleteMarketplaceService(svc.id);
        success('Listing deleted', svc.name);
      } catch (e) {
        toastError('Could not delete the listing', e instanceof Error ? e.message : undefined);
        return { error: e instanceof Error && e.message ? e.message : 'The listing was not deleted.' };
      } finally { refresh(); }
    },
  } : {};

  const saveEdit = async () => {
    if (creating) {
      setSaving(true);
      try {
        await createMarketplaceService({
          title: draft.title.trim(),
          description: draft.description.trim() || undefined,
          pricing: draft.pricing.trim() || undefined,
          providerName: draft.providerName.trim(),
        });
        success('Listing created', draft.title);
        setCreating(false);
      } catch (e) {
        toastError('Could not create the listing', e instanceof Error ? e.message : undefined);
      } finally {
        setSaving(false);
        refresh();
      }
      return;
    }
    if (!editing) return;
    setSaving(true);
    try {
      await updateMarketplaceService(editing.id, {
        title: draft.title.trim(),
        description: draft.description.trim(),
        pricing: draft.pricing.trim(),
      });
      success('Listing saved', draft.title);
      setEditing(null);
    } catch (e) {
      toastError('Could not save the listing', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
      refresh();
    }
  };
  const filteredServices = services.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  // Offered to the assistant: Add Service and the card's live switch, Edit
  // and Delete (which still asks) - refused on the sample listings, whose
  // menu items are disabled for the same reason.
  const sampleEn = live.length > 0 ? undefined : 'These listings are samples; publish your own to manage it here.';
  const sampleEl = live.length > 0 ? undefined : 'Οι καταχωρίσεις είναι δείγματα· δημοσιεύστε τη δική σας για να τη διαχειριστείτε.';
  const byName = (list: Service[]) => rowOptions(list, (s) => s.id, (s) => s.name);
  const serviceById = (id?: string) => services.find((s) => s.id === id);
  usePageList([
    {
      id: 'services',
      labelEn: 'Service listings',
      labelEl: 'Καταχωρίσεις υπηρεσιών',
      rows: isLoading ? undefined : filteredServices.map((s) => `${s.name} · ${s.category} · ${s.price} (${s.priceType}) · ${s.isActive ? 'live' : 'hidden'} · ${s.bookings} bookings`),
      total: services.length,
      sample: live.length === 0,
    },
  ]);
  usePageControls([
    { id: 'add_service', labelEn: 'Open the new listing form', labelEl: 'Άνοιγμα φόρμας νέας καταχώρισης', writes: false, run: openCreate },
    // `isActive` alone (updateMarketplaceService): live and hidden are opposites.
    { id: 'publish_service', labelEn: 'Make listing live', labelEl: 'Δημοσίευση καταχώρισης', writes: true, options: byName(filteredServices.filter((s) => !s.isActive)), unavailableEn: sampleEn, unavailableEl: sampleEl, undo: (v) => ({ control: 'hide_service', value: v }), run: (v) => { const s = serviceById(v); return !s ? ROW_GONE : serviceActions.onActive ? serviceActions.onActive(s, true) : { error: sampleEn ?? 'This listing is a sample.' }; } },
    { id: 'hide_service', labelEn: 'Hide listing', labelEl: 'Απόκρυψη καταχώρισης', writes: true, options: byName(filteredServices.filter((s) => s.isActive)), unavailableEn: sampleEn, unavailableEl: sampleEl, undo: (v) => ({ control: 'publish_service', value: v }), run: (v) => { const s = serviceById(v); return !s ? ROW_GONE : serviceActions.onActive ? serviceActions.onActive(s, false) : { error: sampleEn ?? 'This listing is a sample.' }; } },
    { id: 'edit_service', labelEn: 'Edit listing', labelEl: 'Επεξεργασία καταχώρισης', writes: false, options: byName(filteredServices), unavailableEn: sampleEn, unavailableEl: sampleEl, run: (v) => { const s = serviceById(v); if (s) serviceActions.onEdit?.(s); } },
    { id: 'delete_service', labelEn: 'Delete listing', labelEl: 'Διαγραφή καταχώρισης', writes: true, options: byName(filteredServices), unavailableEn: sampleEn, unavailableEl: sampleEl, run: (v) => { const s = serviceById(v); return !s ? ROW_GONE : serviceActions.onDelete ? serviceActions.onDelete(s) : { error: sampleEn ?? 'This listing is a sample.' }; } },
  ]);

  return (
    <AppShell
      title="My Services"
      titleEl="Οι υπηρεσίες μου"
      description="What founders find and book, with price and whether each listing is live"
      descriptionEl="Τι βρίσκουν και κλείνουν οι ιδρυτές, με τιμή και αν η κάθε καταχώριση είναι ενεργή"
      actions={<Button size="sm" onClick={openCreate}><Plus className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Add Service" el="Προσθήκη υπηρεσίας" compact /></Button>}
    >
      <div className="space-y-6">
        {!showDemoData && services.length === 0 && (
          <EmptyState
            illustration="default"
            title="No services listed"
            description="Create your first service offering to start receiving bookings."
            askAiPrompt="I have not listed any services. Help me describe a first offering based on a typical service provider on CoFounderBay."
            action={<Button size="sm" onClick={openCreate}><Plus className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Add Service" el="Προσθήκη υπηρεσίας" compact /></Button>}
          />
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
          <Input
            aria-label={bilingualInline("Search services", "Αναζήτηση υπηρεσιών")}
            placeholder={bilingualInline("Search services…", "Αναζήτηση υπηρεσιών…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 kpi-odd-span-md gap-4 md:grid-cols-3">
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground"><BilingualText en="Total Services" el="Σύνολο υπηρεσιών" compact /></p>
              <p className="page-stat text-xl font-bold">{services.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground"><BilingualText en="Active" el="Ενεργά" compact /></p>
              <p className="page-stat text-xl font-bold text-status-success">
                {services.filter((s) => s.isActive).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground"><BilingualText en="Total Bookings" el="Σύνολο κρατήσεων" compact /></p>
              <p className="page-stat text-xl font-bold">
                {services.reduce((acc, s) => acc + s.bookings, 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Services List */}
        <div className="space-y-3">
          {filteredServices.map((service) => (
            <ServiceCard key={service.id} service={service} {...serviceActions} />
          ))}
          {filteredServices.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Store className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" aria-hidden="true" />
                <h3 className="font-medium"><BilingualText en="No services found" el="Δεν βρέθηκαν υπηρεσίες" compact /></h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <BilingualText en="Try adjusting your search or add a new service" el="Δοκιμάστε άλλη αναζήτηση ή προσθέστε νέα υπηρεσία" wrap />
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Dialog open={editing !== null || creating} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{creating ? 'New listing' : 'Edit listing'}</DialogTitle>
            <DialogDescription>{creating ? 'Published to the services marketplace.' : 'Saved to your marketplace listing.'}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void saveEdit(); }}>
            <div className="space-y-1.5">
              <Label htmlFor="svc-title"><BilingualText en="Title" el="Τίτλος" compact /></Label>
              <Input id="svc-title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-description"><BilingualText en="Description" el="Περιγραφή" compact /></Label>
              <Textarea id="svc-description" rows={4} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
            </div>
            {creating && (
              <div className="space-y-1.5">
                <Label htmlFor="svc-provider"><BilingualText en="Provider name" el="Όνομα παρόχου" compact /></Label>
                <Input id="svc-provider" value={draft.providerName} onChange={(e) => setDraft((d) => ({ ...d, providerName: e.target.value }))} placeholder={bilingualInline("Your name or firm", "Το όνομά σας ή η εταιρεία σας")} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="svc-pricing"><BilingualText en="Pricing" el="Τιμολόγηση" compact /></Label>
              <Input id="svc-pricing" value={draft.pricing} onChange={(e) => setDraft((d) => ({ ...d, pricing: e.target.value }))} placeholder="e.g. From €500" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setEditing(null); setCreating(false); }}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
              <Button type="submit" disabled={saving || !draft.title.trim() || (creating && !draft.providerName.trim())}>
                {saving ? 'Saving…' : creating ? 'Publish' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
