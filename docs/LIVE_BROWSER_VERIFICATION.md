# Live Browser Verification

Date: 2026-09-27

## Initial attempt

Unable to execute the requested real-browser journey because the CoFounderBay
web preview did not become reachable after the required temporary proxy
configuration was applied.

- Fixture was loaded programmatically without printing credentials, tokens,
  cookies, or file contents.
- The web workflow was restarted with per-process
  `NEXT_PUBLIC_API_USE_PROXY=1` and `API_PROXY_TARGET` derived from the fixture
  API base (with `/api` removed).
- Next.js reached `Ready` and compiled the root route in workflow logs, but the
  managed preview health check failed.
- A fresh browser navigation to `/login` returned HTTP 502, so no login,
  network, cookie, research CRUD, reload, delete, logout, or protected-route
  assertions could be performed.
- A second restart without the temporary env override was attempted to restore
  the original workflow configuration; it also failed the managed preview
  health check. The workflow logs still showed Next.js reaching `Ready`.

No application data was created or modified by this browser attempt. The
shortlist GET 500 was not repeated, per request.

## Retry

The managed web workflow was retried once with a 120-second startup timeout
and the temporary proxy overrides. The preview then loaded `/login` in a
fresh browser context. The founder fixture was filled into the visible form
and submitted.

- `POST /api/auth/login` was observed, but returned `404`.
- The UI stayed on `/login` and displayed `Request failed`.
- No `/api/auth/me` request was observed, and the journey could not proceed
  to research CRUD.
- The web workflow was restored with the original configuration using a
  120-second restart timeout; restoration succeeded.

This is a backend/proxy routing blocker for the requested journey, not a
claim of successful authentication or UI CRUD.

## Final status

Browser verification remains incomplete: the login submission returned 404.
The initial 502 startup issue was resolved by the longer startup timeout.
The original frontend workflow is restored, and the main agent confirmed that
`/login` renders in the managed preview. The disposable API/database and private
fixture file have been removed. Real backend HTTP results, which must not be
conflated with browser results, are in `LIVE_BACKEND_VERIFICATION.md`.