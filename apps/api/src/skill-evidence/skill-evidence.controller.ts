import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SkillEvidenceService } from './skill-evidence.service';

@Controller('skill-evidence')
@UseGuards(JwtAuthGuard)
export class SkillEvidenceController {
  constructor(private readonly evidence: SkillEvidenceService) {}

  @Get('candidates')
  candidates(@CurrentUser() user: { id: string }) {
    return this.evidence.candidates(user.id);
  }

  @Get('user/:userId')
  forUser(@Param('userId') userId: string) {
    return this.evidence.forUser(userId);
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  link(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.evidence.link(user.id, body);
  }

  @Delete(':id')
  unlink(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.evidence.unlink(user.id, id);
  }
}
