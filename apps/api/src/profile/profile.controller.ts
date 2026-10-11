import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-optional.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { createProfileSchema, updateProfileSchema } from '@cofounderbay/shared';

type UserPayload = { id: string; email: string; role: string };

@Controller()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@CurrentUser() user: UserPayload) {
    const profile = await this.profileService.getOwnProfile(user.id);
    if (!profile) {
      return { profile: null, hasCompletedOnboarding: false };
    }
    return { profile, hasCompletedOnboarding: true };
  }

  @Post('me/profile')
  @UseGuards(JwtAuthGuard)
  async createProfile(@CurrentUser() user: UserPayload, @Body() body: unknown) {
    const input = createProfileSchema.parse(body);
    return this.profileService.upsertProfile(user.id, input, true);
  }

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@CurrentUser() user: UserPayload, @Body() body: unknown) {
    const input = updateProfileSchema.parse(body);
    return this.profileService.upsertProfile(user.id, input, false);
  }

  @Get('profiles/:userId')
  @UseGuards(OptionalJwtAuthGuard)
  async getPublicProfile(
    @Param('userId') userId: string,
    @CurrentUser() user?: UserPayload,
  ) {
    return this.profileService.getPublicProfile(userId, user?.id);
  }

  @Get('skills')
  async listSkills(@Query('category') category?: string) {
    return this.profileService.listSkills(category);
  }
}
