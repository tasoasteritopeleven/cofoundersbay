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
import { ProgramService } from './program.service';

@Controller('programs')
@UseGuards(JwtAuthGuard)
export class ProgramController {
  constructor(private readonly programService: ProgramService) {}

  @Post('organization/:orgId')
  async create(
    @Request() req: { user: { id: string } },
    @Param('orgId') orgId: string,
    @Body() data: {
      name: string;
      slug: string;
      description?: string;
      shortDescription?: string;
      programType: string;
      startDate?: string;
      endDate?: string;
      applicationDeadline?: string;
      capacity?: number;
      isPublic?: boolean;
      logoUrl?: string;
      coverImageUrl?: string;
      curriculum?: Record<string, unknown>;
      requirements?: Record<string, unknown>;
      benefits?: Record<string, unknown>;
      settings?: Record<string, unknown>;
    },
  ) {
    return this.programService.create(req.user.id, orgId, {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      applicationDeadline: data.applicationDeadline ? new Date(data.applicationDeadline) : undefined,
    });
  }

  @Get()
  async findPublicPrograms(
    @Query('programType') programType?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.programService.findPublicPrograms({
      programType,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('my-programs')
  async getMyPrograms(@Request() req: { user: { id: string } }) {
    return this.programService.getUserPrograms(req.user.id);
  }

  @Get('organization/:orgId')
  async findByOrganization(
    @Request() req: { user: { id: string } },
    @Param('orgId') orgId: string,
    @Query('status') status?: string,
    @Query('programType') programType?: string,
    @Query('isPublic') isPublic?: string,
  ) {
    return this.programService.findByOrganization(orgId, req.user.id, {
      status,
      programType,
      isPublic: isPublic === 'true' ? true : isPublic === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  async findById(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.programService.findById(id, req.user.id);
  }

  @Patch(':id')
  async update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() data: Record<string, unknown>,
  ) {
    return this.programService.update(id, req.user.id, data as any);
  }

  @Delete(':id')
  async delete(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.programService.delete(id, req.user.id);
  }

  // Participant management
  @Post(':id/apply')
  async applyToProgram(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() data?: { application?: Record<string, unknown> },
  ) {
    return this.programService.applyToProgram(id, req.user.id, data?.application);
  }

  @Get(':id/participants')
  async getParticipants(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
  ) {
    return this.programService.getParticipants(id, req.user.id, { status, role });
  }

  @Patch(':id/participants/:participantId')
  async updateParticipant(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @Body() data: {
      status?: string;
      role?: string;
      progress?: number;
      score?: number;
      rank?: number;
      notes?: string;
      feedback?: Record<string, unknown>;
    },
  ) {
    return this.programService.updateParticipant(id, req.user.id, participantId, data);
  }

  // Milestone management
  @Post(':id/milestones')
  async addMilestone(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() data: {
      title: string;
      description?: string;
      dueDate?: string;
      sortOrder?: number;
      requirements?: Record<string, unknown>;
      deliverables?: Record<string, unknown>;
      isRequired?: boolean;
    },
  ) {
    return this.programService.addMilestone(id, req.user.id, {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    });
  }

  @Patch('milestones/:milestoneId')
  async updateMilestone(
    @Request() req: { user: { id: string } },
    @Param('milestoneId') milestoneId: string,
    @Body() data: Record<string, unknown>,
  ) {
    return this.programService.updateMilestone(milestoneId, req.user.id, data as any);
  }

  @Delete('milestones/:milestoneId')
  async deleteMilestone(
    @Request() req: { user: { id: string } },
    @Param('milestoneId') milestoneId: string,
  ) {
    return this.programService.deleteMilestone(milestoneId, req.user.id);
  }
}
