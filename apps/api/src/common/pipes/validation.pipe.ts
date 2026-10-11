import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ZodSchema } from 'zod';
import { BusinessError } from '../errors/business-error.exception';

@Injectable()
export class ValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        // Zod validation error
        const zodError = error as { issues: Array<{ path: string[]; message: string }> };
        const fieldErrors = zodError.issues.reduce((acc, issue) => {
          const field = issue.path.join('.');
          acc[field] = issue.message;
          return acc;
        }, {} as Record<string, string>);

        throw BusinessError.validation('Validation failed', fieldErrors);
      }

      // Non-Zod error
      throw BusinessError.validation('Invalid input format');
    }
  }
}
