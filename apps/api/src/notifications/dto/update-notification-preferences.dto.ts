import { IsIn, IsOptional } from 'class-validator';

export const DIGEST_FREQUENCIES = ['daily', 'weekly', 'monthly', 'never'] as const;
export type DigestFrequencyValue = typeof DIGEST_FREQUENCIES[number];

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsIn(DIGEST_FREQUENCIES)
  digestFrequency?: DigestFrequencyValue;
}
