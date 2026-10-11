import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MentorshipService } from './mentorship.service';

@Controller('mentorship')
@UseGuards(JwtAuthGuard)
export class MentorshipController {
  constructor(private readonly mentorshipService: MentorshipService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Mentor Discovery
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('mentors')
  async discoverMentors(
    @Query('industries') industries?: string,
    @Query('skills') skills?: string,
    @Query('startupStages') startupStages?: string,
    @Query('availabilityStatus') availabilityStatus?: string,
    @Query('isFree') isFree?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.mentorshipService.discoverMentors({
      industries: industries ? industries.split(',') : undefined,
      skills: skills ? skills.split(',') : undefined,
      startupStages: startupStages ? startupStages.split(',') : undefined,
      availabilityStatus,
      isFree: isFree !== undefined ? isFree === 'true' : undefined,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('mentors/:userId')
  async getMentorProfile(@Param('userId') userId: string) {
    return this.mentorshipService.getMentorProfile(userId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Mentor Requests
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('requests')
  async sendMentorRequest(
    @Request() req: any,
    @Body() body: {
      mentorId: string;
      message: string;
      goals?: string;
      focusAreas?: string[];
      preferredFormat?: string;
      preferredTimes?: Record<string, unknown>;
      workspaceId?: string;
      programId?: string;
    },
  ) {
    return this.mentorshipService.sendMentorRequest(req.user.id, body);
  }

  @Get('requests/sent')
  async getMySentRequests(@Request() req: any) {
    return this.mentorshipService.getMyMentorRequests(req.user.id, 'sent');
  }

  @Get('requests/received')
  async getMyReceivedRequests(@Request() req: any) {
    return this.mentorshipService.getMyMentorRequests(req.user.id, 'received');
  }

  @Post('requests/:requestId/respond')
  async respondToRequest(
    @Request() req: any,
    @Param('requestId') requestId: string,
    @Body() body: { accept: boolean; responseMessage?: string },
  ) {
    return this.mentorshipService.respondToMentorRequest(
      req.user.id,
      requestId,
      body,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Mentorship Relationships
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('relationships')
  async getMyMentorships(
    @Request() req: any,
    @Query('role') role: 'mentor' | 'mentee' = 'mentee',
  ) {
    return this.mentorshipService.getMyMentorships(req.user.id, role);
  }

  @Get('relationships/:id')
  async getMentorshipById(@Request() req: any, @Param('id') id: string) {
    return this.mentorshipService.getMentorshipById(id, req.user.id);
  }

  @Patch('relationships/:id')
  async updateMentorship(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      status?: string;
      goals?: Record<string, unknown>;
      focusAreas?: string[];
      mentorNotes?: string;
      menteeNotes?: string;
      nextSessionAt?: string;
    },
  ) {
    return this.mentorshipService.updateMentorship(id, req.user.id, {
      ...body,
      nextSessionAt: body.nextSessionAt ? new Date(body.nextSessionAt) : undefined,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Sessions
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('relationships/:relationshipId/sessions')
  async scheduleSession(
    @Request() req: any,
    @Param('relationshipId') relationshipId: string,
    @Body() body: {
      title?: string;
      description?: string;
      scheduledAt: string;
      duration?: number;
      timezone?: string;
      meetingType?: string;
      meetingUrl?: string;
      meetingLocation?: string;
      agenda?: string;
    },
  ) {
    return this.mentorshipService.scheduleSession(req.user.id, relationshipId, {
      ...body,
      scheduledAt: new Date(body.scheduledAt),
    });
  }

  @Get('relationships/:relationshipId/sessions')
  async getSessionsByRelationship(
    @Request() req: any,
    @Param('relationshipId') relationshipId: string,
  ) {
    return this.mentorshipService.getSessionsByRelationship(
      relationshipId,
      req.user.id,
    );
  }

  @Patch('sessions/:sessionId')
  async updateSession(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body() body: {
      title?: string;
      description?: string;
      scheduledAt?: string;
      duration?: number;
      meetingType?: string;
      meetingUrl?: string;
      meetingLocation?: string;
      status?: string;
      agenda?: string;
      mentorNotes?: string;
      menteeNotes?: string;
      actionItems?: Record<string, unknown>[];
      mentorRating?: number;
      menteeRating?: number;
      mentorFeedback?: string;
      menteeFeedback?: string;
    },
  ) {
    return this.mentorshipService.updateSession(sessionId, req.user.id, {
      ...body,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    });
  }

  @Get('sessions/upcoming')
  async getUpcomingSessions(@Request() req: any) {
    return this.mentorshipService.getUpcomingSessions(req.user.id);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Mentor Dashboard
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('dashboard/mentor')
  async getMentorDashboard(@Request() req: any) {
    return this.mentorshipService.getMentorDashboardStats(req.user.id);
  }
}
