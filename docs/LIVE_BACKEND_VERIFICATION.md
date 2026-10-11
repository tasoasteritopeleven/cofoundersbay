# Live backend verification

Run timestamp: 2026-09-27T17:29:01.105Z

Command: `node scripts/live-backend-verification.cjs` from `source/cofoundersbay`.

Original Nest main/AppModule, real Passport JWT/Argon2/Prisma; no auth or DB mocks. Fresh private mkdtemp PostgreSQL cluster, Unix socket only, explicit disposable DB identity checks before SQL/push. Schema pushed only here (never migrations or broad seed). Schema-generated client and transpiled source stay in staging. Explicit child environment; no inherited secrets or dotenv files. The app's built-in automation rule seeder runs against this disposable DB. Automation timers run normally; Redis queues disabled by absent REDIS_URL; cache/search/Ollama traffic blocked; SMTP is unconfigured (mailer disabled); OAuth/Stripe/S3/AI keys absent. No provider integration certification. Configured-email startup is a separate known issue and is not tested here; no mail provider was enabled or repaired.

Temporary API: http://127.0.0.1:37213/api. Runner tears down its own API/DB after this run. HTTP re-fetch/new login tests are not a rendered-browser reload test. Production Secure-cookie behavior is not covered in NODE_ENV=test.

| Check | Result | Sanitized evidence |
|---|---|---|
| Disposable database identity | PASS | cfb_disposable; fresh cluster; private Unix socket; TCP disabled |
| Shared project compiler emission | PASS | TypeScript createProgram; semantic diagnostics 0; codes none; noEmitOnError=false |
| API project compiler emission | PASS | TypeScript createProgram; semantic diagnostics 0; codes none; noEmitOnError=false |
| API emitted configuration verified | PASS | CommonJS; decorator metadata enabled; original esModuleInterop=false; auth controller has no runtime express import |
| Schema-only tables exist | PASS | Direct SQL expects all four tables |
| Original Nest reachable | PASS | http://127.0.0.1:37213/api/auth/me returned 401 |
| Register founder (real Argon2 and DB) | PASS | POST /auth/register → 201; expected 201 |
| Register investor | PASS | POST /auth/register → 201; expected 201 |
| Register second founder | PASS | POST /auth/register → 201; expected 201 |
| Cookie attributes | PASS | HttpOnly access/refresh; SameSite=Lax; refresh path /api/auth (test environment) |
| Cookie-authenticated current user | PASS | GET /auth/me → 200; expected 200 |
| Anonymous denied | PASS | GET /shortlist → 401; expected 401 |
| Wrong role denied | PASS | GET /admin/users → 403; expected 403 |
| Incorrect password denied | PASS | POST /auth/login → 401; expected 401 |
| Missing CSRF denied | PASS | POST /shortlist → 403; expected 403 |
| Mismatched CSRF denied | PASS | POST /shortlist → 403; expected 403 |
| Founder empty shortlist HTTP | PASS | GET /shortlist → 200; expected 200 |
| Founder empty shortlist shape | PASS |  |
| Other account empty shortlist HTTP | PASS | GET /shortlist → 200; expected 200 |
| Other account empty shortlist shape | PASS |  |
| Shortlist create | PASS | POST /shortlist → 201; expected 201 |
| Shortlist update | PASS | PATCH /shortlist/9a12504f-fcb8-4ab1-aa00-3aaf4fa4d6ac/note → 200; expected 200 |
| Second shortlist create | PASS | POST /shortlist → 201; expected 201 |
| Shortlist HTTP reload | PASS | GET /shortlist → 200; expected 200 |
| Reload contains exactly owner saved entries | PASS |  |
| Reload contains persisted private note | PASS |  |
| Role comes from User and profile skills resolve | PASS |  |
| Null profile and note serialized | PASS |  |
| Shortlist first page HTTP | PASS | GET /shortlist?limit=1 → 200; expected 200 |
| First page cursor and contents | PASS |  |
| Shortlist cursor page HTTP | PASS | GET /shortlist?limit=1&cursor=b310f0a8-7bcc-474d-bc6b-b261f9ef368d → 200; expected 200 |
| Cursor page has remaining item only | PASS |  |
| Shortlist SQL corroboration | PASS |  |
| Other account list | PASS | GET /shortlist → 200; expected 200 |
| Other account cannot read private shortlist | PASS |  |
| Other account cannot mutate shortlist | PASS | PATCH /shortlist/66f13813-3b45-4c9d-b318-1497513aaf68/note → 400; expected 400/403/404 |
| Other account saves its own private note | PASS | POST /shortlist → 201; expected 201 |
| Other account populated shortlist HTTP | PASS | GET /shortlist → 200; expected 200 |
| Other account sees only its own note and null profile | PASS |  |
| Owner list after other account save | PASS | GET /shortlist → 200; expected 200 |
| Owner cannot read other account private note | PASS |  |
| Research board create | PASS | POST /research/boards → 201; expected 201 |
| Research board ID | PASS | Required fixture captured |
| Cross-resource board read denied | PASS | GET /research/boards/01f2f23a-777f-4787-a953-3186ee383865 → 403; expected 403/404 |
| Cross-resource board write denied | PASS | PATCH /research/boards/01f2f23a-777f-4787-a953-3186ee383865 → 403; expected 403/404 |
| Research board update | PASS | PATCH /research/boards/01f2f23a-777f-4787-a953-3186ee383865 → 200; expected 200 |
| Research board read | PASS | GET /research/boards/01f2f23a-777f-4787-a953-3186ee383865 → 200; expected 200 |
| Research update persists on HTTP read | PASS |  |
| Research board delete | PASS | DELETE /research/boards/01f2f23a-777f-4787-a953-3186ee383865 → 200; expected 200 |
| Deleted board unavailable | PASS | GET /research/boards/01f2f23a-777f-4787-a953-3186ee383865 → 404; expected 403/404 |
| Tenant a membership scope | PASS | GET /sso/memberships → 200; expected 200 |
| Tenant a sees own membership only | PASS |  |
| Tenant a resource owner positive control | PASS | PATCH /organizations/fixture-org-a → 200; expected 200 |
| Tenant a cannot edit tenant b resource | PASS | PATCH /organizations/fixture-org-b → 403; expected 403 |
| Tenant a cannot grant foreign resource membership | PASS | POST /organizations/fixture-org-b/members → 403; expected 403 |
| Tenant b membership scope | PASS | GET /sso/memberships → 200; expected 200 |
| Tenant b sees own membership only | PASS |  |
| Tenant b resource owner positive control | PASS | PATCH /organizations/fixture-org-b → 200; expected 200 |
| Tenant b cannot edit tenant a resource | PASS | PATCH /organizations/fixture-org-a → 403; expected 403 |
| Tenant b cannot grant foreign resource membership | PASS | POST /organizations/fixture-org-a/members → 403; expected 403 |
| Cross-tenant resource denial SQL corroboration | PASS | Two tenant-linked owner updates persist; denied edits/grants leave names and membership rows unchanged |
| Downgraded resource member cannot edit own tenant resource | PASS | PATCH /organizations/fixture-org-a → 403; expected 403 |
| Global tenant administration role denial (separate boundary) | PASS | PATCH /tenants/fixture-tenant-b → 403; expected 403 |
| Original refresh captured | PASS | Required fixture captured |
| Refresh rotation | PASS | POST /auth/refresh → 201; expected 201 |
| Rotated refresh captured | PASS | Required fixture captured |
| Refresh token changes | PASS |  |
| Rotated token replay denied | PASS | POST /auth/refresh → 401; expected 401 |
| Expired persisted refresh denied | PASS | POST /auth/refresh → 401; expected 401 |
| Correctly signed expired JWT denied | PASS | GET /auth/me → 401; expected 401 |
| New login after persistence writes | PASS | POST /auth/login → 201; expected 201 |
| Logout refresh captured from successful new login | PASS | Required fixture captured |
| New-login refresh cookie matches body | PASS | Required fixture captured |
| Pre-logout refresh exists in SQL | PASS |  |
| New login reads shortlist | PASS | GET /shortlist → 200; expected 200 |
| New session persistence and projection | PASS |  |
| Shortlist delete | PASS | DELETE /shortlist/9a12504f-fcb8-4ab1-aa00-3aaf4fa4d6ac → 200; expected 200 |
| Second shortlist delete | PASS | DELETE /shortlist/66f13813-3b45-4c9d-b318-1497513aaf68 → 200; expected 200 |
| Delete SQL corroboration | PASS |  |
| Shortlist empty after delete HTTP | PASS | GET /shortlist → 200; expected 200 |
| Deleted entries absent on HTTP read | PASS |  |
| Logout | PASS | POST /auth/logout → 201; expected 201 |
| Logout clears auth cookie | PASS |  |
| Logged-out cookie session denied | PASS | GET /auth/me → 401; expected 401 |
| Logout refresh deleted in SQL | PASS |  |
| Logged-out refresh revoked | PASS | POST /auth/refresh → 401; expected 401 |
| Synthetic accounts SQL corroboration | PASS |  |

Scope exclusions: exhaustive 22-persona/tenant membership matrix, OAuth/SSO, payment, upload, AI, queues, browser accessibility. Failures are findings; this runner does not repair application behavior.

## Outcome and interpretation limits

87 passing and 0 failing assertion rows; rows are not independent user journeys. A failed shortlist HTTP status, shape, pagination, role/skills, private-note or session assertion produces a FAIL row and nonzero runner exit code. The shortlist checks cover two owners and three synthetic accounts: empty and populated HTTP reads, User.role projection, nullable profile/note, skills, two-page cursor traversal, private notes, cross-owner isolation, and fresh-login HTTP read-after-write. The prior Profile.role selection failure is not reproduced by this run. Fixture rows are removed with the disposable cluster.

Research persistence here means HTTP read-after-write, not database restart or browser reload. Tenant checks exercise organization membership on tenant-linked resources, not every tenant guard or mixed-membership combination. Refresh expiry is tested by backdating the disposable token row; access expiry uses a correctly signed already-expired JWT, not natural waiting. Logout proves cookie clearing and refresh revocation, not immediate revocation of copied access JWTs. Any browser results are recorded separately in LIVE_BROWSER_VERIFICATION.md. Cleanup below is runner policy, not independently asserted by this report.
