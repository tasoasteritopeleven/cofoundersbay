import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesService, ROLE_DASHBOARD_CONFIG, ROLE_PERMISSIONS } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('my-roles')
  async getMyRoles(@Request() req: { user: { id: string } }) {
    return this.rolesService.getUserRoleFacets(req.user.id);
  }

  @Get('primary')
  async getPrimaryRole(@Request() req: { user: { id: string } }) {
    return this.rolesService.getPrimaryRole(req.user.id);
  }

  @Get('dashboard-context')
  async getDashboardContext(@Request() req: { user: { id: string } }) {
    return this.rolesService.getUserDashboardContext(req.user.id);
  }

  @Get('permissions')
  async getMyPermissions(@Request() req: { user: { id: string } }) {
    return this.rolesService.getUserPermissions(req.user.id);
  }

  @Get('check-permission/:permission')
  async checkPermission(
    @Request() req: { user: { id: string } },
    @Param('permission') permission: string,
  ) {
    const hasPermission = await this.rolesService.checkUserPermission(
      req.user.id,
      permission,
    );
    return { permission, hasPermission };
  }

  @Post('add')
  async addRole(
    @Request() req: { user: { id: string } },
    @Body()
    body: {
      roleType: string;
      scope?: string;
      scopeId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.rolesService.addRoleFacet(
      req.user.id,
      body.roleType as any,
      body.scope as any,
      body.scopeId,
      body.metadata as any,
    );
  }

  @Delete(':roleId')
  async removeRole(
    @Request() req: { user: { id: string } },
    @Param('roleId') roleId: string,
  ) {
    return this.rolesService.removeRoleFacet(req.user.id, roleId);
  }

  @Patch(':roleId/set-primary')
  async setPrimaryRole(
    @Request() req: { user: { id: string } },
    @Param('roleId') roleId: string,
  ) {
    return this.rolesService.setPrimaryRole(req.user.id, roleId);
  }

  @Get('dashboard-config/:roleType')
  getDashboardConfig(@Param('roleType') roleType: string) {
    return this.rolesService.getDashboardConfig(roleType as any);
  }

  @Get('all-dashboard-configs')
  getAllDashboardConfigs() {
    return ROLE_DASHBOARD_CONFIG;
  }

  @Get('all-permissions')
  getAllPermissions() {
    return ROLE_PERMISSIONS;
  }

  // Stakeholder profile endpoints
  @Get('mentor-profile')
  async getMentorProfile(@Request() req: { user: { id: string } }) {
    return this.rolesService.getMentorProfile(req.user.id);
  }

  @Post('mentor-profile')
  async updateMentorProfile(
    @Request() req: { user: { id: string } },
    @Body() data: Record<string, unknown>,
  ) {
    return this.rolesService.createOrUpdateMentorProfile(req.user.id, data as any);
  }

  @Get('investor-profile')
  async getInvestorProfile(@Request() req: { user: { id: string } }) {
    return this.rolesService.getInvestorProfile(req.user.id);
  }

  @Post('investor-profile')
  async updateInvestorProfile(
    @Request() req: { user: { id: string } },
    @Body() data: Record<string, unknown>,
  ) {
    return this.rolesService.createOrUpdateInvestorProfile(req.user.id, data as any);
  }

  @Get('service-provider-profile')
  async getServiceProviderProfile(@Request() req: { user: { id: string } }) {
    return this.rolesService.getServiceProviderProfile(req.user.id);
  }

  @Post('service-provider-profile')
  async updateServiceProviderProfile(
    @Request() req: { user: { id: string } },
    @Body() data: Record<string, unknown>,
  ) {
    return this.rolesService.createOrUpdateServiceProviderProfile(req.user.id, data as any);
  }
}
