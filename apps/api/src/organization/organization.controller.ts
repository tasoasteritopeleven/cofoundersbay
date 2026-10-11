import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationService } from './organization.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  async create(
    @Request() req: { user: { id: string } },
    @Body() data: {
      type: string;
      name: string;
      slug: string;
      displayName?: string;
      description?: string;
      tagline?: string;
      website?: string;
      email?: string;
      phone?: string;
      logoUrl?: string;
      coverImageUrl?: string;
      primaryColor?: string;
      country?: string;
      city?: string;
      address?: string;
      timezone?: string;
      industries?: string[];
      stages?: string[];
      focusAreas?: string[];
      tenantId?: string;
    },
  ) {
    return this.organizationService.create(req.user.id, data);
  }

  @Get()
  async findAll(
    @Query('type') type?: string,
    @Query('isVerified') isVerified?: string,
    @Query('isFeatured') isFeatured?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.organizationService.findAll({
      type,
      isVerified: isVerified === 'true' ? true : isVerified === 'false' ? false : undefined,
      isFeatured: isFeatured === 'true' ? true : isFeatured === 'false' ? false : undefined,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('my-organizations')
  async getMyOrganizations(@Request() req: { user: { id: string } }) {
    return this.organizationService.getUserOrganizations(req.user.id);
  }

  @Get(':id')
  async findById(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.organizationService.findById(id, req.user.id);
  }

  @Get('slug/:slug')
  async findBySlug(
    @Request() req: { user: { id: string } },
    @Param('slug') slug: string,
  ) {
    return this.organizationService.findBySlug(slug, req.user.id);
  }

  @Patch(':id')
  async update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() data: Record<string, unknown>,
  ) {
    return this.organizationService.update(id, req.user.id, data as any);
  }

  @Delete(':id')
  async delete(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.organizationService.delete(id, req.user.id);
  }

  // Member management
  @Get(':id/members')
  async getMembers(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Query('role') role?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.organizationService.getMembers(id, req.user.id, {
      role,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Post(':id/members')
  async addMember(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() data: { userId: string; role: string; title?: string; department?: string },
  ) {
    return this.organizationService.addMember(id, req.user.id, data);
  }

  @Patch(':id/members/:memberId')
  async updateMember(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() data: { role?: string; title?: string; department?: string; isActive?: boolean },
  ) {
    return this.organizationService.updateMember(id, req.user.id, memberId, data);
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.organizationService.removeMember(id, req.user.id, memberId);
  }

  // Mentor pool
  @Get(':id/mentors')
  async getMentorPool(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.organizationService.getMentorPool(id, req.user.id);
  }

  @Post(':id/mentors')
  async addMentorToPool(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() data: { userId: string; expertiseAreas?: string[]; maxMentees?: number },
  ) {
    return this.organizationService.addMentorToPool(id, req.user.id, data);
  }
}
