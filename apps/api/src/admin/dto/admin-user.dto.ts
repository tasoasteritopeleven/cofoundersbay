import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class ChangeUserRoleDto {
  @IsEnum(Role)
  role!: Role;
}

export class BanUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1_000)
  reason!: string;
}

export class UpdateUserModerationDto {
  @IsIn(['active', 'suspended', 'banned'])
  status!: 'active' | 'suspended' | 'banned';

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  reason?: string;
}
