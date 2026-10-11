import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { OrgService } from './org.service';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-optional.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('org')
@UseGuards(OptionalJwtAuthGuard)
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  /** The authenticated user's memberships, in the shape every /org page uses. */
  @Get('my-memberships')
  @UseGuards(JwtAuthGuard)
  async getMyMemberships(@CurrentUser() user: { id: string }) {
    return this.orgService.getUserMemberships(user.id);
  }

  @Get(':slug')
  async getOrgProfile(@Param('slug') slug: string) {
    return this.orgService.getOrgProfile(slug);
  }

  @Get(':slug/opportunities')
  async getOrgOpportunities(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.orgService.getOrgOpportunities(slug, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get(':slug/cohorts')
  async getOrgCohorts(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.orgService.getOrgCohorts(slug, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get(':slug/cohorts/:cohortId')
  async getOrgCohortDetail(
    @Param('slug') slug: string,
    @Param('cohortId') cohortId: string,
  ) {
    return this.orgService.getOrgCohortDetail(slug, cohortId);
  }

  @Get(':slug/members')
  async getOrgMembers(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.orgService.getOrgMembers(slug, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }
}
