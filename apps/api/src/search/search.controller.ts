import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-optional.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller()
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('search')
  @UseGuards(OptionalJwtAuthGuard)
  async searchAll(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.search.searchGlobal({
      q: q?.trim() || '',
      category: category?.trim() || 'all',
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('search/profiles')
  @UseGuards(OptionalJwtAuthGuard)
  async searchProfiles(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('roles') roles?: string,
    @Query('location') location?: string,
    @Query('skills') skills?: string,
    @Query('industries') industries?: string,
    @Query('stage') stage?: string,
    @Query('languages') languages?: string,
    @Query('commitment') commitment?: string,
    @Query('availability') availability?: string,
    @Query('investmentStages') investmentStages?: string,
    @Query('fundingStage') fundingStage?: string,
    @Query('sortBy') sortBy?: 'relevance' | 'recent' | 'active',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedRoles = parseList(roles) ?? (role ? [role] : undefined);
    const result = await this.search.searchProfiles({
      q: q?.trim() || undefined,
      roles: parsedRoles?.map((r) => r.trim()).filter(Boolean),
      location: location?.trim() || undefined,
      skills: parseList(skills),
      industries: parseList(industries),
      stage: parseList(stage),
      languages: parseList(languages),
      commitment: parseList(commitment) ?? parseList(availability),
      investmentStages: parseList(investmentStages) ?? parseList(fundingStage),
      sortBy,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return result;
  }

  @Get('recommendations')
  @UseGuards(JwtAuthGuard)
  async recommendations(
    @CurrentUser() user: { id: string },
    @Query('role') role?: string,
    @Query('limit') limit?: string,
  ) {
    return this.search.getRecommendations(user.id, {
      role: role?.trim() || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}

function parseList(input?: string): string[] | undefined {
  const items = (input ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!items.length) return undefined;
  return Array.from(new Set(items));
}
