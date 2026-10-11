import { IsString, IsOptional, IsArray, ValidateNested, IsEnum, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  /**
   * `tool` is accepted so a confirmed tool call can report its result in the
   * history of the next turn. The server never fabricates one: it only ever
   * arrives from a client that performed the action the user confirmed.
   */
  @IsEnum(['system', 'user', 'assistant', 'tool'])
  role!: 'system' | 'user' | 'assistant' | 'tool';

  @IsString()
  content!: string;

  /** The declared capability this result belongs to. */
  @IsString()
  @IsOptional()
  toolName?: string;
}

export class ChatRequestDto {
  @IsString()
  message!: string;

  @IsString()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @IsOptional()
  agentId?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  @IsOptional()
  history?: ChatMessageDto[];

  @IsOptional()
  context?: Record<string, any>;

  /**
   * Offer the model the function-calling catalogue for this turn.
   *
   * Opt-in, and off by default, so a turn that does not ask for it produces
   * byte-identical requests to before tools existed. Not every model served by
   * Ollama supports them, and silently adding a `tools` field to every request
   * would change behaviour for deployments that never asked. Turning the
   * default on is a decision for whenever a tool-capable model is the
   * configured one.
   */
  @IsBoolean()
  @IsOptional()
  enableTools?: boolean;
}

export class CreateConversationDto {
  @IsString()
  @IsOptional()
  agentId?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  initialMessage?: string;
}

export class UpdateAIPreferencesDto {
  @IsString()
  @IsOptional()
  preferredModel?: string;

  @IsString()
  @IsOptional()
  preferredProvider?: string;

  @IsNumber()
  @IsOptional()
  temperature?: number;

  @IsNumber()
  @IsOptional()
  maxTokens?: number;

  @IsString()
  @IsOptional()
  responseStyle?: string;

  @IsString()
  @IsOptional()
  responseLanguage?: string;

  @IsBoolean()
  @IsOptional()
  useEmoji?: boolean;

  @IsBoolean()
  @IsOptional()
  enableStreaming?: boolean;

  @IsBoolean()
  @IsOptional()
  enableSuggestions?: boolean;

  @IsBoolean()
  @IsOptional()
  enableContextMemory?: boolean;

  @IsBoolean()
  @IsOptional()
  enableAutoSave?: boolean;

  @IsBoolean()
  @IsOptional()
  saveConversations?: boolean;

  @IsBoolean()
  @IsOptional()
  shareForTraining?: boolean;

  @IsBoolean()
  @IsOptional()
  anonymizeData?: boolean;

  @IsString()
  @IsOptional()
  defaultAgent?: string;
}
