import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConnectionsService } from './connections.service';

const sendRequestSchema = z.object({
  receiverId: z.string().uuid(),
  message: z.string().trim().max(500).optional(),
});

const respondSchema = z.object({
  status: z.enum(['accepted', 'declined']),
});

@Controller('connections')
@UseGuards(JwtAuthGuard)
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Post()
  async sendRequest(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    const input = sendRequestSchema.parse(body);
    return this.connections.sendRequest(user.id, input.receiverId, input.message);
  }

  @Get()
  async listConnections(
    @CurrentUser() user: { id: string },
    @Query('type') type?: 'sent' | 'received' | 'accepted',
    @Query('limit') limitRaw?: string,
  ) {
    return this.connections.listConnections(
      user.id,
      type ?? 'received',
      limitRaw ? parseInt(limitRaw, 10) : 50,
    );
  }

  @Patch(':connectionId')
  async respond(
    @CurrentUser() user: { id: string },
    @Param('connectionId') connectionId: string,
    @Body() body: unknown,
  ) {
    const input = respondSchema.parse(body);
    return this.connections.respondToRequest(connectionId, user.id, input.status);
  }

  /** The sender's half of `respond`: take back a request nobody has answered. */
  @Delete(':connectionId')
  async withdraw(
    @CurrentUser() user: { id: string },
    @Param('connectionId') connectionId: string,
  ) {
    return this.connections.withdrawRequest(connectionId, user.id);
  }

  @Post('block/:userId')
  async blockUser(
    @CurrentUser() user: { id: string },
    @Param('userId') targetUserId: string,
  ) {
    return this.connections.blockUser(user.id, targetUserId);
  }

  @Get('status/:userId')
  async getStatus(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
  ) {
    return this.connections.getConnectionStatus(user.id, userId);
  }
}
