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
import { OpportunitiesService, CreateOpportunityDto, UpdateOpportunityDto } from './opportunities.service';

@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Get()
  async findAll(
    @Query('type') type?: string,
    @Query('isRemote') isRemote?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.opportunitiesService.findAll({
      type: type as any,
      isRemote: isRemote === 'true' ? true : isRemote === 'false' ? false : undefined,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.opportunitiesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req: any, @Body() dto: CreateOpportunityDto) {
    const opportunity = await this.opportunitiesService.create(req.user.id, dto);
    return { opportunity };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateOpportunityDto,
  ) {
    const isAdmin = req.user.role === 'admin';
    const opportunity = await this.opportunitiesService.update(id, req.user.id, dto, isAdmin);
    return { opportunity };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string, @Request() req: any) {
    const isAdmin = req.user.role === 'admin';
    return this.opportunitiesService.delete(id, req.user.id, isAdmin);
  }
}
