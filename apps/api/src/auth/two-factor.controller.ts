import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { TwoFactorService, TwoFactorSetupResponse } from './two-factor.service';

class VerifyCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

@Controller('auth/2fa')
@UseGuards(JwtAuthGuard)
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Get('status')
  async getStatus(@CurrentUser() user: { id: string }) {
    return this.twoFactorService.getStatus(user.id);
  }

  @Post('setup')
  async setup(@CurrentUser() user: { id: string }) {
    return this.twoFactorService.generateSetup(user.id);
  }

  @Post('verify')
  async verifyAndEnable(
    @CurrentUser() user: { id: string },
    @Body() dto: VerifyCodeDto,
  ) {
    return this.twoFactorService.verifyAndEnable(user.id, dto.code);
  }

  @Delete('disable')
  async disable(
    @CurrentUser() user: { id: string },
    @Body() dto: VerifyCodeDto,
  ) {
    return this.twoFactorService.disable(user.id, dto.code);
  }

  @Post('backup-codes/regenerate')
  async regenerateBackupCodes(
    @CurrentUser() user: { id: string },
    @Body() dto: VerifyCodeDto,
  ) {
    return this.twoFactorService.regenerateBackupCodes(user.id, dto.code);
  }
}
