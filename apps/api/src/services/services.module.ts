import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { ServiceOffersController } from './service-offers.controller';
import { ServiceOffersService } from './service-offers.service';

@Module({
  controllers: [ServiceOffersController],
  providers: [UserService, ServiceOffersService],
  exports: [UserService, ServiceOffersService],
})
export class ServicesModule {}
