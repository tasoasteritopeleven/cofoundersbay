import { Controller, Get, Query } from '@nestjs/common';
import { TransparencyService } from './transparency.service';

/** Public like /public/stats: the report is for anyone, members or not. */
@Controller('public')
export class TransparencyController {
  constructor(private readonly transparency: TransparencyService) {}

  @Get('transparency')
  report(@Query('period') period?: string) {
    return this.transparency.report(period);
  }
}
