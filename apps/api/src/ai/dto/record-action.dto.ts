import { IsIn, IsObject, IsOptional, IsString, Length, Matches } from 'class-validator';
import { AI_ACTION_OUTCOMES } from '../ai-action-audit.service';

/**
 * Shape check only. Whether `actionId` names a real capability, and whether
 * `args` satisfy its schema, is decided by `AIActionAuditService` against the
 * shared declarations — the same gate a model's tool call passes through.
 * Duplicating that list here would give it a second copy to drift from.
 */
export class RecordAIActionDto {
  @IsString()
  @Length(1, 100)
  // Capability ids are snake_case identifiers. Constrained here so a rejected
  // id cannot carry a payload into the log line that reports it.
  @Matches(/^[a-z][a-z0-9_]*$/)
  actionId!: string;

  @IsIn([...AI_ACTION_OUTCOMES])
  outcome!: (typeof AI_ACTION_OUTCOMES)[number];

  @IsOptional()
  @IsObject()
  args?: Record<string, unknown>;
}
