import { Body, Controller, Get, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MessagingService } from './messaging.service';

const directConversationSchema = z.object({
  userId: z.string().uuid(),
});

const flagsSchema = z.object({
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

const validationModeSchema = z.object({
  mode: z.enum(['casual', 'one_party', 'two_party']),
});

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('conversations')
  async listConversations(@CurrentUser() user: { id: string }) {
    const conversations = await this.messaging.listConversations(user.id);
    return { conversations };
  }

  @Post('conversations/direct')
  async getOrCreateDirect(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    const { userId } = directConversationSchema.parse(body);
    const conversation = await this.messaging.getOrCreateDirectConversation(user.id, userId);
    return { conversationId: conversation.id };
  }

  @Get('conversations/:conversationId/messages')
  async listMessages(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
  ) {
    const messages = await this.messaging.listMessages(user.id, conversationId, limit ? parseInt(limit, 10) : 50);
    return { messages };
  }

  @Patch('conversations/:conversationId')
  async updateConversationFlags(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Body() body: unknown,
  ) {
    const flags = flagsSchema.parse(body);
    return this.messaging.setConversationFlags(user.id, conversationId, flags);
  }

  @Get('conversations/:conversationId/validation')
  async getValidation(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
  ) {
    const validationState = await this.messaging.getConversationValidation(user.id, conversationId);
    return { validationState };
  }

  @Put('conversations/:conversationId/validation')
  async updateValidationMode(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Body() body: unknown,
  ) {
    const { mode } = validationModeSchema.parse(body);
    return this.messaging.updateConversationValidationMode(user.id, conversationId, mode);
  }

  @Post('conversations/:conversationId/validation/accept')
  async acceptValidation(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
  ) {
    return this.messaging.acceptConversationValidation(user.id, conversationId);
  }

  @Post('conversations/:conversationId/validation/decline')
  async declineValidation(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
  ) {
    return this.messaging.declineConversationValidation(user.id, conversationId);
  }

  @Get('conversations/:conversationId/transcript')
  async exportTranscript(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    const fmt = format === 'txt' ? 'txt' : 'json';
    const { contentType, data } = await this.messaging.exportConversationTranscript(user.id, conversationId, fmt);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="transcript-${conversationId.slice(0, 8)}.${fmt}"`);
    res.send(data);
  }
}

