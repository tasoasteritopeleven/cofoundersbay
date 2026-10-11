import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [ConfigModule],
  controllers: [BillingController],
  providers: [StripeService, BillingService],
  exports: [BillingService],
})
export class BillingModule {}

