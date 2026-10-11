import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GraphService } from './graph.service';

@Controller('graph')
@UseGuards(JwtAuthGuard)
export class GraphController {
  constructor(private readonly graph: GraphService) {}

  @Get('me')
  async getMe(@CurrentUser() user: { id: string }) {
    return this.graph.getMyGraph(user.id);
  }
}
