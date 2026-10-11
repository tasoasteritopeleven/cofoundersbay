import { Transform } from 'class-transformer';
import {
  IsIn,
  IsString,
  Length,
  Matches,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'jobFieldsForType', async: false })
class JobFieldsForType implements ValidatorConstraintInterface {
  validate(type: unknown, args: ValidationArguments): boolean {
    const body = args.object as Record<string, unknown>;
    if (type === 'generate-document') return body.targetUserId === undefined;
    if (type === 'analyze-profile') {
      return ['prompt', 'conversationId', 'model', 'featureUsed'].every((key) => body[key] === undefined);
    }
    return false;
  }

  defaultMessage(): string {
    return 'Job fields must match the selected type';
  }
}

export class EnqueueJobDto {
  @IsIn(['generate-document', 'analyze-profile'])
  @Validate(JobFieldsForType)
  type!: 'generate-document' | 'analyze-profile';

  @Transform(({ obj, key }) => obj[key])
  @ValidateIf((body) => body.type === 'generate-document' || body.agentId !== undefined)
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  agentId?: string;

  @Transform(({ obj, key }) => obj[key])
  @ValidateIf((body) => body.type === 'generate-document')
  @IsString()
  @Length(1, 20_000)
  @Matches(/\S/)
  prompt?: string;

  @Transform(({ obj, key }) => obj[key])
  @ValidateIf((body) => body.type === 'analyze-profile')
  @IsString()
  @Length(1, 128)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  targetUserId?: string;

  @Transform(({ obj, key }) => obj[key])
  @ValidateIf((body) => body.conversationId !== undefined)
  @IsString()
  @Length(1, 128)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  conversationId?: string;

  @Transform(({ obj, key }) => obj[key])
  @ValidateIf((body) => body.model !== undefined)
  @IsString()
  @Length(1, 200)
  @Matches(/^\S+$/)
  model?: string;

  @Transform(({ obj, key }) => obj[key])
  @ValidateIf((body) => body.featureUsed !== undefined)
  @IsString()
  @Length(1, 100)
  @Matches(/\S/)
  featureUsed?: string;
}
