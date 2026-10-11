import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export const DIGEST_TYPES = ['daily', 'weekly', 'monthly'] as const;

export class SendTestDigestDto {
  @IsOptional()
  @IsIn(DIGEST_TYPES)
  type?: typeof DIGEST_TYPES[number];
}

export class UpdateDigestPreferencesDto {
  @IsOptional() @IsBoolean() daily?: boolean;
  @IsOptional() @IsBoolean() weekly?: boolean;
  @IsOptional() @IsBoolean() monthly?: boolean;
  @IsOptional() @IsBoolean() connections?: boolean;
  @IsOptional() @IsBoolean() messages?: boolean;
  @IsOptional() @IsBoolean() opportunities?: boolean;
  @IsOptional() @IsBoolean() events?: boolean;
  @IsOptional() @IsBoolean() updates?: boolean;
}
