import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-optional.guard';
import { JobsService } from './jobs.service';

const createJobSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(5000).optional(),
  role: z.string().trim().max(80).optional(),
  location: z.string().trim().max(120).optional(),
  isRemote: z.boolean().optional(),
});

@Controller()
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get('jobs')
  @UseGuards(OptionalJwtAuthGuard)
  async list(@Query('limit') limit?: string) {
    const parsed = limit ? Math.min(Math.max(parseInt(limit, 10), 1), 50) : 10;
    const items = await this.jobs.listActive(parsed);
    return { jobs: items };
  }

  @Post('jobs')
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    const input = createJobSchema.parse(body);
    const job = await this.jobs.createJob(user.id, input);
    return { job };
  }

  @Get('jobs/:jobId')
  @UseGuards(OptionalJwtAuthGuard)
  async getOne(@Param('jobId') jobId: string) {
    const job = await this.jobs.getJob(jobId);
    return { job };
  }

  @Delete('jobs/:jobId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async remove(
    @CurrentUser() user: { id: string },
    @Param('jobId') jobId: string,
  ) {
    await this.jobs.deleteJob(jobId, user.id);
  }
}
