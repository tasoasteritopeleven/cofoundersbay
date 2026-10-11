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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-optional.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GroupsService } from './groups.service';
import {
  createGroupSchema,
  updateGroupSchema,
  createGroupPostSchema,
  createGroupCommentSchema,
  groupFiltersSchema,
  paginationSchema,
  updateMemberRoleSchema,
} from './dto/groups.dto';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  // ── Groups CRUD ───────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard)
  async createGroup(
    @CurrentUser() user: { id: string },
    @Body() body: unknown,
  ) {
    const dto = createGroupSchema.parse(body);
    return this.groups.createGroup(user.id, dto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async listGroups(
    @Query() query: unknown,
    @CurrentUser() user?: { id: string },
  ) {
    const filters = groupFiltersSchema.parse(query);
    return this.groups.listGroups(filters, user?.id);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyGroups(@CurrentUser() user: { id: string }) {
    return this.groups.getMyGroups(user.id);
  }

  @Get(':groupId')
  @UseGuards(OptionalJwtAuthGuard)
  async getGroup(
    @Param('groupId') groupId: string,
    @CurrentUser() user?: { id: string },
  ) {
    return this.groups.getGroup(groupId, user?.id);
  }

  @Patch(':groupId')
  @UseGuards(JwtAuthGuard)
  async updateGroup(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
    @Body() body: unknown,
  ) {
    const dto = updateGroupSchema.parse(body);
    return this.groups.updateGroup(groupId, user.id, dto);
  }

  @Delete(':groupId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteGroup(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
  ) {
    return this.groups.deleteGroup(groupId, user.id);
  }

  // ── Membership ────────────────────────────────────────────────────────────

  @Post(':groupId/join')
  @UseGuards(JwtAuthGuard)
  async joinGroup(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
  ) {
    return this.groups.joinGroup(groupId, user.id);
  }

  @Post(':groupId/leave')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async leaveGroup(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
  ) {
    return this.groups.leaveGroup(groupId, user.id);
  }

  @Patch(':groupId/members/:userId/role')
  @UseGuards(JwtAuthGuard)
  async updateMemberRole(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
    @Param('userId') targetUserId: string,
    @Body() body: unknown,
  ) {
    const dto = updateMemberRoleSchema.parse(body);
    return this.groups.updateMemberRole(groupId, user.id, targetUserId, dto);
  }

  @Delete(':groupId/members/:userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async removeMember(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.groups.removeMember(groupId, user.id, targetUserId);
  }

  @Get(':groupId/members')
  @UseGuards(OptionalJwtAuthGuard)
  async listMembers(
    @Param('groupId') groupId: string,
    @Query() query: unknown,
  ) {
    const pagination = paginationSchema.parse(query);
    return this.groups.listMembers(groupId, pagination);
  }

  // ── Posts ─────────────────────────────────────────────────────────────────

  @Post(':groupId/posts')
  @UseGuards(JwtAuthGuard)
  async createPost(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
    @Body() body: unknown,
  ) {
    const dto = createGroupPostSchema.parse(body);
    return this.groups.createPost(groupId, user.id, dto);
  }

  @Get(':groupId/posts')
  @UseGuards(OptionalJwtAuthGuard)
  async listPosts(
    @Param('groupId') groupId: string,
    @Query() query: unknown,
    @CurrentUser() user?: { id: string },
  ) {
    const pagination = paginationSchema.parse(query);
    return this.groups.listPosts(groupId, pagination, user?.id);
  }

  @Delete(':groupId/posts/:postId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deletePost(
    @CurrentUser() user: { id: string },
    @Param('postId') postId: string,
  ) {
    return this.groups.deletePost(postId, user.id);
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  @Post(':groupId/posts/:postId/comments')
  @UseGuards(JwtAuthGuard)
  async createComment(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
    @Param('postId') postId: string,
    @Body() body: unknown,
  ) {
    const dto = createGroupCommentSchema.parse(body);
    return this.groups.createComment(groupId, postId, user.id, dto);
  }

  @Get(':groupId/posts/:postId/comments')
  async listComments(
    @Param('postId') postId: string,
    @Query() query: unknown,
  ) {
    const pagination = paginationSchema.parse(query);
    return this.groups.listComments(postId, pagination);
  }

  // ── Reactions ─────────────────────────────────────────────────────────────

  @Post(':groupId/posts/:postId/react')
  @UseGuards(JwtAuthGuard)
  async reactToPost(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
    @Param('postId') postId: string,
    @Body() body: { emoji: string },
  ) {
    if (!body.emoji) throw new Error('emoji is required');
    return this.groups.reactToPost(groupId, postId, user.id, body.emoji);
  }
}
