import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SubscriptionStatus, BillingCycle, Prisma, Role } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { AutomationService } from '../automation/automation.service';

export type BillingActor = { id: string; role?: Role };

export type BillingContactInput = {
  name: string; email: string; phone?: string; company?: string;
  addressLine1?: string; addressLine2?: string; city?: string;
  state?: string; postalCode?: string; country?: string;
  vatId?: string; taxId?: string; legalName?: string;
};

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly stripeSvc: StripeService,
    @Optional() private readonly automation?: AutomationService,
  ) {}

  private webBaseUrl(): string {
    return this.config.get<string>('WEB_BASE_URL') ?? 'http://localhost:3000';
  }

  private defaultPriceId(): string | null {
    return this.config.get<string>('STRIPE_PRICE_ID_PREMIUM') ?? null;
  }

  // ── Plans ─────────────────────────────────────────────────────────────────

  async listPlans() {
    const plans = await this.prisma.billingPlan.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { sortOrder: 'asc' },
    });
    return { plans };
  }

  async getPlan(planId: string) {
    const plan = await this.prisma.billingPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    return { plan };
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  async getSubscription(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    return { subscription: sub };
  }

  async getUserSubscriptions(userId: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    return { subscriptions };
  }

  private async getOrCreateFreePlan(): Promise<string> {
    let freePlan = await this.prisma.billingPlan.findUnique({ where: { name: 'free' } });
    if (!freePlan) {
      freePlan = await this.prisma.billingPlan.create({
        data: {
          name: 'free',
          displayName: 'Free',
          description: 'Basic access to the platform',
          planType: 'free',
          priceMonthly: 0,
          priceAnnual: 0,
          features: { matching: 'basic', messages: 100, events: true },
          isPublic: true,
          isActive: true,
          sortOrder: 0,
        },
      });
    }
    return freePlan.id;
  }

  private async ensureStripeCustomer(userId: string): Promise<{ customerId: string; subscriptionId?: string }> {
    const stripe = this.stripeSvc.getClient();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new BadRequestException('User not found');

    const existing = await this.prisma.subscription.findFirst({ where: { userId } });
    if (existing?.stripeCustomerId) {
      return { customerId: existing.stripeCustomerId, subscriptionId: existing.id };
    }

    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId },
    });

    // Create a free subscription by default
    const freePlanId = await this.getOrCreateFreePlan();
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const sub = await this.prisma.subscription.create({
      data: {
        userId,
        planId: freePlanId,
        billingCycle: 'monthly' as BillingCycle,
        status: 'active' as SubscriptionStatus,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        stripeCustomerId: customer.id,
      },
    });

    return { customerId: customer.id, subscriptionId: sub.id };
  }

  async createCheckoutSession(params: { userId: string; priceId?: string | null }) {
    if (!this.stripeSvc.isEnabled()) throw new BadRequestException('Billing is not configured');

    const priceId = params.priceId?.trim() || this.defaultPriceId();
    if (!priceId) throw new BadRequestException('Missing priceId');

    const stripe = this.stripeSvc.getClient();
    const { customerId } = await this.ensureStripeCustomer(params.userId);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: params.userId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${this.webBaseUrl()}/settings?billing=success`,
      cancel_url: `${this.webBaseUrl()}/settings?billing=cancel`,
      subscription_data: {
        metadata: { userId: params.userId },
      },
      metadata: { userId: params.userId },
    });

    return { url: session.url, id: session.id };
  }

  async createPortalSession(userId: string) {
    if (!this.stripeSvc.isEnabled()) throw new BadRequestException('Billing is not configured');
    const stripe = this.stripeSvc.getClient();
    const { customerId } = await this.ensureStripeCustomer(userId);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.webBaseUrl()}/settings`,
    });

    return { url: session.url };
  }

  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const stripe = this.stripeSvc.getClient();
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new BadRequestException('Missing STRIPE_WEBHOOK_SECRET');
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.syncFromCheckoutSession(session);
        return;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await this.syncFromStripeSubscription(sub);
        if (sub.status === 'canceled') {
          const existingSub = await this.prisma.subscription.findFirst({
            where: { stripeSubscriptionId: sub.id },
            select: { id: true, userId: true, tenantId: true },
          });
          if (existingSub?.userId) {
            this.automation?.fire({
              triggerType: 'subscription_canceled',
              targetUserId: existingSub.userId,
              targetEntityType: 'subscription',
              targetEntityId: existingSub.id,
              tenantId: existingSub.tenantId ?? undefined,
            }).catch(() => {});
          }
        }
        return;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          const existingSub = await this.prisma.subscription.findFirst({
            where: { stripeCustomerId: customerId },
            select: { id: true, userId: true, tenantId: true },
          });
          if (existingSub?.userId) {
            this.automation?.fire({
              triggerType: 'subscription_failed_payment',
              targetUserId: existingSub.userId,
              targetEntityType: 'subscription',
              targetEntityId: existingSub.id,
              tenantId: existingSub.tenantId ?? undefined,
              payload: { attemptCount: invoice.attempt_count },
            }).catch(() => {});
          }
        }
        return;
      }
      default:
        return;
    }
  }

  private async syncFromCheckoutSession(session: Stripe.Checkout.Session) {
    if (session.mode !== 'subscription') return;

    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const stripeSubscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (!stripeCustomerId || !stripeSubscriptionId) return;

    const userId = session.client_reference_id ?? (session.metadata?.userId || null);
    if (!userId) return;

    // Find existing subscription for this user
    const existing = await this.prisma.subscription.findFirst({ where: { userId } });
    
    if (existing) {
      // Update existing subscription with Stripe IDs
      await this.prisma.subscription.update({
        where: { id: existing.id },
        data: {
          stripeCustomerId,
          stripeSubscriptionId,
          status: 'active' as SubscriptionStatus,
        },
      });
    }
    // If no existing subscription, the webhook for subscription.created will handle it
  }

  private mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    switch (status) {
      case 'trialing':
      case 'active':
      case 'past_due':
      case 'canceled':
      case 'unpaid':
      case 'incomplete':
      case 'incomplete_expired':
      case 'paused':
        return status as SubscriptionStatus;
      default:
        return 'past_due' as SubscriptionStatus;
    }
  }

  // ── Feature Gating ─────────────────────────────────────────────────────────

  async getFeatureAccess(userId: string, feature: string): Promise<{ allowed: boolean; reason?: string }> {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: ['active', 'trialing'] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) return { allowed: false, reason: 'no_subscription' };

    // featureOverrides at subscription level take absolute priority
    const overrides = (sub as Record<string, unknown>).featureOverrides as Record<string, unknown> | null;
    if (overrides && feature in overrides) {
      return { allowed: Boolean(overrides[feature]) };
    }

    const features = sub.plan.features as Record<string, unknown>;
    const value = features[feature];
    if (value === undefined || value === false || value === null) {
      return { allowed: false, reason: 'plan_limit' };
    }
    return { allowed: true };
  }

  async getUserSubscriptionFull(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    return { subscription: sub };
  }

  // ── Invoices ───────────────────────────────────────────────────────────────

  async getUserInvoices(userId: string) {
    const sub = await this.prisma.subscription.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
    if (!sub) return { invoices: [] };
    const invoices = await this.prisma.invoice.findMany({
      where: { subscriptionId: sub.id },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { invoices };
  }

  // ── Billing Contact ────────────────────────────────────────────────────────

  async getBillingContact(subscriptionId: string) {
    return (this.prisma as Record<string, unknown> & typeof this.prisma).billingContact
      ? (this.prisma as unknown as { billingContact: { findUnique: (args: unknown) => Promise<unknown> } })
          .billingContact.findUnique({ where: { subscriptionId } })
      : null;
  }

  async upsertBillingContact(subscriptionId: string, data: BillingContactInput) {
    // Explicit projection protects this low-level method even when it is called
    // outside an HTTP controller and therefore outside ValidationPipe.
    const safeData: BillingContactInput = {
      name: data.name,
      email: data.email,
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.company !== undefined && { company: data.company }),
      ...(data.addressLine1 !== undefined && { addressLine1: data.addressLine1 }),
      ...(data.addressLine2 !== undefined && { addressLine2: data.addressLine2 }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.state !== undefined && { state: data.state }),
      ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
      ...(data.country !== undefined && { country: data.country }),
      ...(data.vatId !== undefined && { vatId: data.vatId }),
      ...(data.taxId !== undefined && { taxId: data.taxId }),
      ...(data.legalName !== undefined && { legalName: data.legalName }),
    };
    const pc = this.prisma as unknown as { billingContact: { upsert: (args: unknown) => Promise<unknown> } };
    return pc.billingContact.upsert({
      where: { subscriptionId },
      create: { subscriptionId, ...safeData },
      update: safeData,
    });
  }

  // ── Seat Management ────────────────────────────────────────────────────────

  private async withSerializableSeatTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, { isolationLevel: 'Serializable' });
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2034' || attempt === 2) throw error;
      }
    }
    throw new Error('Seat transaction retry limit exceeded');
  }

  private async synchronizeSeatCount(tx: Prisma.TransactionClient, subscriptionId: string, hasIncludedSeat: boolean) {
    const allocated = await tx.seatAllocation.count({ where: { subscriptionId, isActive: true } });
    const activeSeatCount = allocated + (hasIncludedSeat ? 1 : 0);
    await tx.subscription.update({ where: { id: subscriptionId }, data: { activeSeatCount } });
    return activeSeatCount;
  }

  async allocateSeat(subscriptionId: string, targetUserId: string, allocatedBy: string) {
    return this.withSerializableSeatTransaction(async (tx) => {
      const sub = await tx.subscription.findUnique({ where: { id: subscriptionId } });
      if (!sub) throw new NotFoundException('Subscription not found');
      const existing = await tx.seatAllocation.findUnique({
        where: { subscriptionId_userId: { subscriptionId, userId: targetUserId } },
      });
      const allocated = await tx.seatAllocation.count({ where: { subscriptionId, isActive: true } });
      const includedSeats = sub.tenantId ? 1 : 0;

      if (existing?.isActive) {
        await tx.subscription.update({
          where: { id: subscriptionId },
          data: { activeSeatCount: allocated + includedSeats },
        });
        return existing;
      }
      if (sub.seatLimit !== null && allocated + includedSeats >= sub.seatLimit) {
        throw new BadRequestException('Seat limit reached');
      }

      const allocation = await tx.seatAllocation.upsert({
        where: { subscriptionId_userId: { subscriptionId, userId: targetUserId } },
        create: { subscriptionId, userId: targetUserId, allocatedBy, isActive: true },
        update: { isActive: true, allocatedAt: new Date(), deactivatedAt: null, allocatedBy },
      });
      await this.synchronizeSeatCount(tx, subscriptionId, Boolean(sub.tenantId));
      return allocation;
    });
  }

  async revokeSeat(subscriptionId: string, targetUserId: string) {
    await this.withSerializableSeatTransaction(async (tx) => {
      const sub = await tx.subscription.findUnique({ where: { id: subscriptionId } });
      if (!sub) throw new NotFoundException('Subscription not found');
      const allocation = await tx.seatAllocation.findUnique({
        where: { subscriptionId_userId: { subscriptionId, userId: targetUserId } },
      });
      if (allocation?.isActive) {
        await tx.seatAllocation.update({
          where: { subscriptionId_userId: { subscriptionId, userId: targetUserId } },
          data: { isActive: false, deactivatedAt: new Date() },
        });
      }
      await this.synchronizeSeatCount(tx, subscriptionId, Boolean(sub.tenantId));
    });
  }

  async listSeatAllocations(subscriptionId: string) {
    return this.prisma.seatAllocation.findMany({
      where: { subscriptionId, isActive: true },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { allocatedAt: 'desc' },
    });
  }

  // ── Tenant Billing ─────────────────────────────────────────────────────────

  private async assertTenantBillingAccess(actor: BillingActor, tenantId: string) {
    if (actor.role === 'admin' || actor.role === 'super_admin') return;
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: actor.id } },
      select: { role: true, isActive: true },
    });
    if (!membership?.isActive || !['owner', 'admin'].includes(membership.role)) {
      throw new ForbiddenException('Tenant billing access requires an active owner or admin membership');
    }
  }

  async getTenantSubscriptionFor(actor: BillingActor, tenantId: string) {
    await this.assertTenantBillingAccess(actor, tenantId);
    return this.getTenantSubscription(tenantId);
  }

  async listTenantSeatsFor(actor: BillingActor, tenantId: string) {
    await this.assertTenantBillingAccess(actor, tenantId);
    const { subscription } = await this.getTenantSubscription(tenantId);
    return { seats: subscription ? await this.listSeatAllocations(subscription.id) : [] };
  }

  async allocateTenantSeatFor(actor: BillingActor, tenantId: string, targetUserId: string) {
    await this.assertTenantBillingAccess(actor, tenantId);
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
      select: { role: true, isActive: true },
    });
    if (!membership?.isActive) throw new BadRequestException('Seats can only be allocated to active tenant members');
    if (membership.role === 'owner') throw new BadRequestException('The tenant owner already uses the included seat');
    const { subscription } = await this.getTenantSubscription(tenantId);
    if (!subscription) throw new BadRequestException('No subscription found');
    return this.allocateSeat(subscription.id, targetUserId, actor.id);
  }

  async revokeTenantSeatFor(actor: BillingActor, tenantId: string, targetUserId: string) {
    await this.assertTenantBillingAccess(actor, tenantId);
    const { subscription } = await this.getTenantSubscription(tenantId);
    if (!subscription) throw new BadRequestException('No subscription found');
    await this.revokeSeat(subscription.id, targetUserId);
  }

  async upsertTenantBillingContactFor(actor: BillingActor, tenantId: string, data: BillingContactInput) {
    await this.assertTenantBillingAccess(actor, tenantId);
    const { subscription } = await this.getTenantSubscription(tenantId);
    if (!subscription) throw new BadRequestException('No subscription found');
    return this.upsertBillingContact(subscription.id, data);
  }

  async getTenantSubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId },
      include: { plan: true, seatAllocations: { where: { isActive: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { subscription: sub };
  }

  // ── Admin: Stats ───────────────────────────────────────────────────────────

  async getAdminStats() {
    const [totalSubs, activeSubs, trialingSubs, pastDueSubs, plans] = await Promise.all([
      this.prisma.subscription.count(),
      this.prisma.subscription.count({ where: { status: 'active' } }),
      this.prisma.subscription.count({ where: { status: 'trialing' } }),
      this.prisma.subscription.count({ where: { status: 'past_due' } }),
      this.prisma.billingPlan.findMany({ orderBy: { sortOrder: 'asc' } }),
    ]);

    const paidInvoices = await this.prisma.invoice.aggregate({
      where: { status: 'paid' },
      _sum: { total: true },
    });

    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const mrrInvoices = await this.prisma.invoice.aggregate({
      where: { status: 'paid', paidAt: { gte: thisMonthStart } },
      _sum: { total: true },
    });

    return {
      totalSubs,
      activeSubs,
      trialingSubs,
      pastDueSubs,
      totalRevenueCents: paidInvoices._sum.total ?? 0,
      mrrCents: mrrInvoices._sum.total ?? 0,
      plans,
    };
  }

  async listAdminSubscriptions(opts: { status?: string; planId?: string; search?: string; take?: number; skip?: number }) {
    const where: Record<string, unknown> = {};
    if (opts.status) where.status = opts.status;
    if (opts.planId) where.planId = opts.planId;

    const subs = await this.prisma.subscription.findMany({
      where,
      include: {
        plan: true,
        user: { select: { id: true, email: true } },
        tenant: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: opts.take ?? 50,
      skip: opts.skip ?? 0,
    });

    if (opts.search) {
      const q = opts.search.toLowerCase();
      return subs.filter(s =>
        s.user?.email?.toLowerCase().includes(q) ||
        s.tenant?.name?.toLowerCase().includes(q)
      );
    }
    return subs;
  }

  async listAdminInvoices(opts: { status?: string; search?: string; take?: number; skip?: number }) {
    const where: Record<string, unknown> = {};
    if (opts.status) where.status = opts.status;

    return this.prisma.invoice.findMany({
      where,
      include: {
        subscription: {
          include: {
            user: { select: { id: true, email: true } },
            tenant: { select: { id: true, name: true } },
          },
        },
        lines: true,
      },
      orderBy: { createdAt: 'desc' },
      take: opts.take ?? 50,
      skip: opts.skip ?? 0,
    });
  }

  // ── Admin: Plan CRUD ───────────────────────────────────────────────────────

  async createPlan(data: {
    name: string; displayName: string; description?: string;
    planType: string; priceMonthly: number; priceAnnual: number;
    currency?: string; seatLimit?: number; storageGb?: number;
    features: Record<string, unknown>; isPublic?: boolean;
    isActive?: boolean; sortOrder?: number;
    stripeProductId?: string; stripePriceIdMonthly?: string; stripePriceIdAnnual?: string;
  }) {
    return this.prisma.billingPlan.create({ data: data as unknown as Parameters<typeof this.prisma.billingPlan.create>[0]['data'] });
  }

  async updatePlan(id: string, data: Partial<{
    displayName: string; description: string; priceMonthly: number;
    priceAnnual: number; features: Record<string, unknown>;
    isPublic: boolean; isActive: boolean; sortOrder: number;
    seatLimit: number; stripePriceIdMonthly: string; stripePriceIdAnnual: string;
  }>) {
    return this.prisma.billingPlan.update({ where: { id }, data: data as unknown as Parameters<typeof this.prisma.billingPlan.update>[0]['data'] });
  }

  async deletePlan(id: string) {
    const subs = await this.prisma.subscription.count({ where: { planId: id } });
    if (subs > 0) throw new BadRequestException('Cannot delete a plan with active subscriptions');
    return this.prisma.billingPlan.delete({ where: { id } });
  }

  // ── Admin: Subscription actions ────────────────────────────────────────────

  async manualOverride(subscriptionId: string, data: { planId?: string; featureOverrides?: Record<string, unknown>; reason?: string }) {
    const update: Record<string, unknown> = {};
    if (data.planId) update.planId = data.planId;
    if (data.featureOverrides) update.featureOverrides = data.featureOverrides;
    return this.prisma.subscription.update({ where: { id: subscriptionId }, data: update });
  }

  async extendTrial(subscriptionId: string, days: number) {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    const newEnd = new Date(sub.trialEnd ?? sub.currentPeriodEnd);
    newEnd.setDate(newEnd.getDate() + days);
    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { trialEnd: newEnd, status: 'trialing' },
    });
  }

  async cancelSubscription(subscriptionId: string, immediate: boolean) {
    if (immediate) {
      return this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'canceled', canceledAt: new Date() },
      });
    }
    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { cancelAtPeriodEnd: true },
    });
  }

  // ── Admin: Coupons ─────────────────────────────────────────────────────────

  async listCoupons() {
    return this.prisma.promotionCode.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createCoupon(data: {
    code: string; discountType: string; discountValue: number;
    currency?: string; maxRedemptions?: number; validUntil?: Date;
    applicablePlans?: string[]; firstTimeOnly?: boolean;
  }) {
    return this.prisma.promotionCode.create({ data });
  }

  async deleteCoupon(id: string) {
    return this.prisma.promotionCode.update({ where: { id }, data: { isActive: false } });
  }

  private async syncFromStripeSubscription(sub: Stripe.Subscription) {
    const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const stripeSubscriptionId = sub.id;

    const stripePriceId = sub.items.data[0]?.price?.id ?? null;
    const maxItemPeriodEnd = sub.items?.data?.length
      ? Math.max(...sub.items.data.map((i) => i.current_period_end))
      : null;
    const currentPeriodEnd = maxItemPeriodEnd 
      ? new Date(maxItemPeriodEnd * 1000) 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
    const currentPeriodStart = sub.items.data[0]?.current_period_start
      ? new Date(sub.items.data[0].current_period_start * 1000)
      : new Date();
    const cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;
    const status = this.mapStripeStatus(sub.status);

    // Find existing subscription by Stripe IDs or user
    const existing =
      (await this.prisma.subscription.findFirst({ where: { stripeCustomerId } })) ??
      (await this.prisma.subscription.findFirst({ where: { stripeSubscriptionId } }));

    const userId = existing?.userId ?? (sub.metadata?.userId || null);
    if (!userId) return;

    // Get or create a premium plan to link to
    let premiumPlan = await this.prisma.billingPlan.findUnique({ where: { name: 'premium' } });
    if (!premiumPlan) {
      premiumPlan = await this.prisma.billingPlan.create({
        data: {
          name: 'premium',
          displayName: 'Premium',
          description: 'Full access to all platform features',
          planType: 'individual_premium',
          priceMonthly: 1900, // $19/month
          priceAnnual: 15900, // $159/year
          features: { matching: 'advanced', messages: 'unlimited', events: true, analytics: true },
          stripePriceIdMonthly: stripePriceId,
          isPublic: true,
          isActive: true,
          sortOrder: 1,
        },
      });
    }

    if (existing) {
      // Update existing subscription
      await this.prisma.subscription.update({
        where: { id: existing.id },
        data: {
          stripeCustomerId,
          stripeSubscriptionId,
          status,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          planId: premiumPlan.id,
        },
      });
    } else {
      // Create new subscription
      await this.prisma.subscription.create({
        data: {
          userId,
          planId: premiumPlan.id,
          billingCycle: 'monthly',
          status,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          stripeCustomerId,
          stripeSubscriptionId,
        },
      });
    }
  }
}

