# CoFounderBay Backend Test Audit Report
## Commit: 15183f589c699fa1bea2df855715662e1ce08fef

### Test Execution Summary
- **Date**: 2026-10-03 19:21:13 UTC
- **Command**: `vitest run --config ../../.devin/vitest.api.config.ts`
- **Exit Code**: 0 (SUCCESS)
- **Total Test Files**: 24 passed (24)
- **Total Tests**: 299 passed (299)
- **Duration**: 15.40s

### Environment Setup
- **Node Version**: v20.20.2
- **Vitest Version**: 5.0.2 (with --ignore-engines flag)
- **Vite Version**: 7.3.6
- **TypeScript Version**: 5.9.3
- **Prisma Version**: 6.19.2
- **Dependencies**: Installed via yarn in isolated /app/audit-toolchain
- **Prisma Client**: Generated successfully
- **Shared Package**: Built successfully

### Priority Test Results (as requested)

#### 1. Tenant Admin Guard (tenant-admin.guard.test.ts)
✅ **PASSED** - 7 tests
- Tenant admin authorization working correctly
- Proper rejection of non-admin users
- Platform admin access verified

#### 2. Tenant Domain Security (tenant-domain.security.test.ts)
✅ **PASSED** - 4 tests
- Domain security checks functioning
- Tenant isolation verified

#### 3. Organization Security (organization.security.test.ts)
✅ **PASSED** - 10 tests
- Organization authorization working
- Member access controls verified
- Admin/owner permissions correct

#### 4. Program Security (program.security.test.ts)
✅ **PASSED** - 9 tests
- Program access controls functioning
- Tenant-scoped program security verified

#### 5. Builder Security (builder.security.test.ts)
✅ **PASSED** - 6 tests
- Builder AI authorization working
- Cache isolation by workspace/actor/model verified
- Editor access requirements enforced

#### 6. Email Queue Service (email-queue.service.test.ts)
✅ **PASSED** - 4 tests
- Email queueing functionality working
- Queue operations verified

#### 7. Email Digest Service (email-digest.service.test.ts)
✅ **PASSED** - 11 tests
- Monthly digest generation working
- User opt-in/opt-out handling correct
- Error handling for Redis unavailability verified
- Empty/disabled/skipped cases handled properly

### Additional Test Results

#### AI & Tool Calls
- **ai/tool-calls.test.ts**: ✅ 22 tests - Tool catalogue, role gating, validation
- **ai/ollama-tools.test.ts**: ✅ 13 tests - Ollama integration, streaming, tool results
- **ai/ai-job-queue.service.test.ts**: ✅ 42 tests - Job queue operations
- **ai/ai-jobs.controller.test.ts**: ✅ 17 tests - HTTP routes, authentication, quotas
- **ai/ai-action-audit.test.ts**: ✅ 16 tests - Action recording, reversibility
- **ai/dto/enqueue-job.dto.test.ts**: ✅ 49 tests - DTO validation

#### Security & Authorization
- **admin/admin.security.test.ts**: ✅ 7 tests - Admin authorization
- **billing/billing.security.test.ts**: ✅ 7 tests - Billing authorization, seat management
- **tenant/tenant.service.test.ts**: ✅ 6 tests - Tenant service operations

#### Services & Features
- **account-export/account-export.service.test.ts**: ✅ 6 tests
- **analytics/analytics.service.test.ts**: ✅ 21 tests
- **automation/safe-webhook.test.ts**: ✅ 20 tests
- **endorsements/endorsements.service.test.ts**: ✅ 2 tests
- **org/org.service.test.ts**: ✅ 1 test
- **research/research.upload-access.test.ts**: ✅ 2 tests
- **uploads/upload-validation.test.ts**: ✅ 6 tests
- **builder/builder.readiness.test.ts**: ✅ 11 tests

### Test Characteristics

#### Mocked Components
All tests use mocked dependencies:
- **Authentication**: JWT guards mocked via `vi.spyOn(JwtAuthGuard.prototype, 'canActivate')`
- **Database**: Prisma client mocked
- **Queue**: BullMQ/Redis mocked
- **External Providers**: SMTP, AI providers, Stripe mocked
- **No live persistence**: No database connections made
- **No real API calls**: No external service calls

#### Test Scope
- ✅ Unit tests with mocked dependencies
- ✅ Authorization logic verification
- ✅ Business logic validation
- ✅ DTO validation
- ✅ Error handling
- ❌ NOT tested: Live database persistence
- ❌ NOT tested: Real JWT verification
- ❌ NOT tested: Actual Redis/queue behavior
- ❌ NOT tested: Real SMTP/AI/payment provider integration

### Key Findings from Latest Push (15183f58)

The commit message indicates: "fix(authz): tenant/org writes check the actor's real place, and commands report only settled writes"

Test results confirm:
1. ✅ Tenant authorization checks are working correctly
2. ✅ Organization authorization properly validates actor membership
3. ✅ Program security enforces tenant-scoped access
4. ✅ Builder AI cache isolation by workspace/actor/model
5. ✅ Email queue and digest services functioning

### Tooling Notes
- Transform time: 64% of tracked time (102.08s)
- Vitest suggests using `fsModuleCache: true` for performance
- NestJS decorator metadata preserved via TypeScript transpilation
- Shared package aliased to source for tests

### Conclusion
All 299 backend tests passed successfully. The test suite covers authorization, security, AI features, email services, and business logic with mocked dependencies. No production code changes were made. Tests verify the logic correctness but do not prove live database persistence, real authentication, or external provider integration.
