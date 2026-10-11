import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccountExportService } from './account-export.service';

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountExportController {
  constructor(private readonly exports: AccountExportService) {}

  /** The signed-in user's own data as one JSON document. `sections` is a comma list; empty means all. */
  @Get('export')
  async export(@CurrentUser() user: { id: string }, @Query('sections') sections?: string) {
    return this.exports.build(user.id, sections ? sections.split(',') : undefined);
  }
}
