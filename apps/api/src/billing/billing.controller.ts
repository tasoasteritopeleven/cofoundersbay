import {
  BadRequestException, Body, Controller, Delete, Get, Headers,
  HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Role } from '@prisma/client';
import { AllocateSeatDto, BillingContactDto } from './dto/billing.dto';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // ── Public ─────────────────────────────────────────────────────────────────

  @Get('plans')
  async listPlans() {
    return this.billing.listPlans();
  }

  // ── Current user ───────────────────────────────────────────────────────────

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  async getSubscription(@CurrentUser() user: { id: string }) {
    return this.billing.getUserSubscriptionFull(user.id);
  }

  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  async getUserInvoices(@CurrentUser() user: { id: string }) {
    return this.billing.getUserInvoices(user.id);
  }

  @Get('feature/:feature')
  @UseGuards(JwtAuthGuard)
  async checkFeature(@CurrentUser() user: { id: string }, @Param('feature') feature: string) {
    return this.billing.getFeatureAccess(user.id, feature);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckout(@CurrentUser() user: { id: string }, @Body() body?: { priceId?: string }) {
    return this.billing.createCheckoutSession({ userId: user.id, priceId: body?.priceId });
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  async createPortal(@CurrentUser() user: { id: string }) {
    return this.billing.createPortalSession(user.id);
  }

  // ── Billing contact (user-level subscription) ──────────────────────────────

  @Get('subscription/billing-contact')
  @UseGuards(JwtAuthGuard)
  async getBillingContact(@CurrentUser() user: { id: string }) {
    const { subscription } = await this.billing.getUserSubscriptionFull(user.id);
    if (!subscription) return { billingContact: null };
    return { billingContact: await this.billing.getBillingContact(subscription.id) };
  }

  @Post('subscription/billing-contact')
  @UseGuards(JwtAuthGuard)
  async upsertBillingContact(@CurrentUser() user: { id: string }, @Body() body: BillingContactDto) {
    const { subscription } = await this.billing.getUserSubscriptionFull(user.id);
    if (!subscription) throw new BadRequestException('No subscription found');
    return this.billing.upsertBillingContact(subscription.id, body);
  }

  // ── Tenant billing ─────────────────────────────────────────────────────────

  @Get('tenant/:tenantId')
  @UseGuards(JwtAuthGuard)
  async getTenantSubscription(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.billing.getTenantSubscriptionFor(user, tenantId);
  }

  @Get('tenant/:tenantId/seats')
  @UseGuards(JwtAuthGuard)
  async listTenantSeats(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.billing.listTenantSeatsFor(user, tenantId);
  }

  @Post('tenant/:tenantId/seats')
  @UseGuards(JwtAuthGuard)
  async allocateTenantSeat(
    @Param('tenantId') tenantId: string,
    @Body() body: AllocateSeatDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.billing.allocateTenantSeatFor(user, tenantId, body.userId);
  }

  @Delete('tenant/:tenantId/seats/:userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeTenantSeat(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    await this.billing.revokeTenantSeatFor(user, tenantId, userId);
  }

  @Post('tenant/:tenantId/billing-contact')
  @UseGuards(JwtAuthGuard)
  async upsertTenantBillingContact(
    @Param('tenantId') tenantId: string,
    @Body() body: BillingContactDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.billing.upsertTenantBillingContactFor(user, tenantId, body);
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async adminStats() {
    return this.billing.getAdminStats();
  }

  @Get('admin/subscriptions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async adminSubscriptions(
    @Query('status') status?: string,
    @Query('planId') planId?: string,
    @Query('search') search?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.billing.listAdminSubscriptions({
      status, planId, search,
      take: take ? parseInt(take) : undefined,
      skip: skip ? parseInt(skip) : undefined,
    });
  }

  @Get('admin/invoices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async adminInvoices(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.billing.listAdminInvoices({
      status, search,
      take: take ? parseInt(take) : undefined,
      skip: skip ? parseInt(skip) : undefined,
    });
  }

  @Post('admin/plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async adminCreatePlan(@Body() body: Parameters<typeof this.billing.createPlan>[0]) {
    return this.billing.createPlan(body);
  }

  @Patch('admin/plans/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async adminUpdatePlan(@Param('id') id: string, @Body() body: Parameters<typeof this.billing.updatePlan>[1]) {
    return this.billing.updatePlan(id, body);
  }

  @Delete('admin/plans/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async adminDeletePlan(@Param('id') id: string) {
    await this.billing.deletePlan(id);
  }

  @Post('admin/subscriptions/:id/override')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async adminOverride(@Param('id') id: string, @Body() body: Parameters<typeof this.billing.manualOverride>[1]) {
    return this.billing.manualOverride(id, body);
  }

  @Post('admin/subscriptions/:id/extend-trial')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async adminExtendTrial(@Param('id') id: string, @Body() body: { days: number }) {
    return this.billing.extendTrial(id, body.days);
  }

  @Post('admin/subscriptions/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async adminCancel(@Param('id') id: string, @Body() body: { immediate?: boolean }) {
    return this.billing.cancelSubscription(id, body.immediate ?? false);
  }

  @Get('admin/coupons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async listCoupons() {
    return this.billing.listCoupons();
  }

  @Post('admin/coupons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async createCoupon(@Body() body: Parameters<typeof this.billing.createCoupon>[0]) {
    return this.billing.createCoupon(body);
  }

  @Delete('admin/coupons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCoupon(@Param('id') id: string) {
    await this.billing.deleteCoupon(id);
  }

  // ── Stripe webhook ─────────────────────────────────────────────────────────

  @Post('webhook')
  async webhook(@Req() req: RawBodyRequest, @Headers('stripe-signature') sig?: string) {
    if (!sig) throw new BadRequestException('Missing stripe-signature');
    const raw = req.rawBody;
    if (!raw || !(raw instanceof Buffer)) throw new BadRequestException('Missing raw body');
    const event = this.billing.constructEvent(raw, sig);
    await this.billing.handleEvent(event);
    return { received: true };
  }
}

