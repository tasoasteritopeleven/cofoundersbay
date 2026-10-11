import { describe, expect, it, vi } from 'vitest';
import { VerificationController } from './verification.controller';

/**
 * `GET /verification/of/:userId` feeds the badge beside someone's name on a
 * profile, a need card or a public card. It answers with methods only.
 */
describe('how someone else is verified', () => {
  it('returns the methods and nothing else', async () => {
    const publicMethods = vi.fn(async () => ['work_email'] as const);
    const controller = new VerificationController({ publicMethods } as never);
    expect(await controller.of('user-1')).toEqual({ methods: ['work_email'] });
    expect(publicMethods).toHaveBeenCalledWith('user-1');
  });

  it('answers an implausible id with no methods instead of a lookup', async () => {
    const publicMethods = vi.fn();
    const controller = new VerificationController({ publicMethods } as never);
    expect(await controller.of('x'.repeat(65))).toEqual({ methods: [] });
    expect(publicMethods).not.toHaveBeenCalled();
  });
});
