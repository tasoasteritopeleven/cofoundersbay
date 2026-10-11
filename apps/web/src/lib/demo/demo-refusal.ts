/** A refusal shaped like the API's: status, message and `details`. */
export class DemoRefusal extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;
  constructor(status: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = status === 409 ? 'CONFLICT' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR';
    this.details = details;
  }
}
