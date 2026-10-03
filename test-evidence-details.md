# Backend Test Evidence - Detailed Breakdown

## Test Execution Details

### Command Executed
```bash
cd /app/cofoundersbay/apps/api
/app/audit-toolchain/node_modules/.bin/vitest run --config ../../.devin/vitest.api.config.ts
```

### Exit Code: 0 (SUCCESS)

## Individual Test File Results

### Priority Tests (Security & Authorization)

1. **tenant/tenant-admin.guard.test.ts** - ✅ 7 tests passed
   - Tenant admin authorization
   - Platform admin access
   - Non-admin rejection

2. **tenant/tenant-domain.security.test.ts** - ✅ 4 tests passed
   - Domain security checks
   - Tenant isolation

3. **organization/organization.security.test.ts** - ✅ 10 tests passed
   - Organization authorization
   - Member access controls
   - Admin/owner permissions

4. **organization/program.security.test.ts** - ✅ 9 tests passed
   - Program access controls
   - Tenant-scoped security

5. **builder/builder.security.test.ts** - ✅ 6 tests passed
   - Builder AI authorization
   - Cache isolation (workspace/actor/model)
   - Editor access enforcement

6. **mailer/email-queue.service.test.ts** - ✅ 4 tests passed
   - Email queueing functionality
   - Queue operations

7. **digests/email-digest.service.test.ts** - ✅ 11 tests passed
   - Monthly digest generation
   - User opt-in/opt-out
   - Error handling (Redis unavailability)
   - Empty/disabled/skipped cases

### AI & Tool Integration Tests

8. **ai/tool-calls.test.ts** - ✅ 22 tests passed
   - Tool catalogue offering
   - Role gating (Wave E)
   - Single tool call review
   - Batch tool call review
   - Argument validation
   - Type checking

9. **ai/ollama-tools.test.ts** - ✅ 13 tests passed
   - Catalogue offering to model
   - Tool call streaming
   - JSON parsing across byte reads
   - Tool result mapping
   - Conversation handling

10. **ai/ai-job-queue.service.test.ts** - ✅ 42 tests passed
    - Job queue operations
    - Queue management
    - Job lifecycle

11. **ai/ai-jobs.controller.test.ts** - ✅ 17 tests passed
    - HTTP routes with mocked dependencies
    - JWT protection
    - Enqueue quota guard
    - Authentication requirements
    - DTO validation
    - Invalid body rejection
    - Owner override prevention
    - Conversation access checks
    - Polling responses
    - Free-tier quota enforcement

12. **ai/ai-action-audit.test.ts** - ✅ 16 tests passed
    - Action recording
    - Subject tracking
    - Irreversibility declaration
    - Partial reversibility (connection withdrawal)
    - Navigation recording
    - Page capability tracking
    - Undo recording
    - Capability validation
    - Argument validation
    - Unknown outcome rejection
    - Malformed action ID rejection
    - Failed write handling
    - Caller trail isolation
    - Action/outcome splitting
    - Limit clamping

13. **ai/dto/enqueue-job.dto.test.ts** - ✅ 49 tests passed
    - DTO validation for job enqueue

### Additional Security Tests

14. **admin/admin.security.test.ts** - ✅ 7 tests passed
    - Admin authorization

15. **billing/billing.security.test.ts** - ✅ 7 tests passed
    - Tenant billing authorization
    - Unrelated member rejection
    - Tenant owner access
    - Tenant admin access
    - Platform admin operational access
    - Seat state transitions
    - Seat allocation/revocation
    - Billing contact allowlist

16. **tenant/tenant.service.test.ts** - ✅ 6 tests passed
    - Tenant service operations

### Service & Feature Tests

17. **account-export/account-export.service.test.ts** - ✅ 6 tests passed
    - Account export functionality

18. **analytics/analytics.service.test.ts** - ✅ 21 tests passed
    - Analytics service operations

19. **automation/safe-webhook.test.ts** - ✅ 20 tests passed
    - Webhook safety checks
    - Webhook validation

20. **endorsements/endorsements.service.test.ts** - ✅ 2 tests passed
    - Endorsement service

21. **org/org.service.test.ts** - ✅ 1 test passed
    - OrgService.getUserMemberships returns only active memberships

22. **research/research.upload-access.test.ts** - ✅ 2 tests passed
    - Research upload access control

23. **uploads/upload-validation.test.ts** - ✅ 6 tests passed
    - Upload validation logic

24. **builder/builder.readiness.test.ts** - ✅ 11 tests passed
    - Readiness assessment contract
    - Builder field retention
    - Score calculation
    - Dimension timestamp handling
    - Empty dimension rejection
    - Dimension deduplication
    - Workspace authorization
    - Missing workspace handling
    - Criterion updates
    - Unknown criteria rejection
    - Mutation contract preservation
    - Editor access requirements

## Test Coverage Summary

### By Category
- **Security & Authorization**: 49 tests (tenant, org, program, builder, admin, billing)
- **AI Features**: 159 tests (tool calls, ollama, job queue, jobs controller, action audit, DTOs)
- **Email Services**: 15 tests (queue, digest)
- **Services & Features**: 76 tests (account export, analytics, automation, endorsements, org, research, uploads, builder readiness)

### Total: 299 tests across 24 files

## Mocked Components (CRITICAL)

All tests use mocked dependencies:
- ✅ Prisma Client (database)
- ✅ JWT Auth Guards (authentication)
- ✅ BullMQ/Redis (queue)
- ✅ Nodemailer (SMTP)
- ✅ AI Providers (OpenAI, Ollama, etc.)
- ✅ Stripe (payments)
- ✅ S3 (file storage)

## What Was NOT Tested

- ❌ Live database persistence
- ❌ Real JWT token verification
- ❌ Actual Redis/BullMQ queue behavior
- ❌ Real SMTP email delivery
- ❌ Actual AI provider API calls
- ❌ Real Stripe payment processing
- ❌ Real S3 file uploads
- ❌ WebSocket connections
- ❌ Real-time features
- ❌ Database migrations
- ❌ Production environment behavior

## Setup Artifacts

### Created Files/Directories
- `/app/audit-toolchain/` - Isolated dependency installation
- `/app/audit-toolchain/package.json` - Toolchain manifest
- `/app/audit-toolchain/node_modules/` - Dependencies
- `/app/cofoundersbay/node_modules` - Symlink to toolchain
- `/app/cofoundersbay/packages/shared/dist/` - Built shared package
- `/app/audit-toolchain/node_modules/@prisma/client/` - Generated Prisma client

### Evidence Files
- `/app/backend-test-results.log` - Full test output
- `/app/backend-test-summary.md` - Executive summary
- `/app/test-evidence-details.md` - This file

## Dependency Versions (from pnpm-lock.yaml)

### Testing Tools
- vitest: 5.0.2
- vite: 7.3.6
- typescript: 5.9.3

### Database
- prisma: 6.19.2
- @prisma/client: 6.19.2

### NestJS Core
- @nestjs/common: 10.4.22
- @nestjs/core: 10.4.22
- @nestjs/platform-express: 10.4.22

### Key Dependencies
- reflect-metadata: 0.2.2
- rxjs: 7.8.2
- class-validator: 0.15.1
- class-transformer: 0.5.1
- zod: 3.25.76

## Conclusion

All 299 backend tests passed successfully, verifying the authorization logic, business rules, and error handling introduced in commit 15183f58. The test suite uses mocked dependencies throughout, so results prove logical correctness but not live system behavior. No production code was modified during this audit.
