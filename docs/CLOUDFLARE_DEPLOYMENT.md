# Deploying CoFounderBay to Cloudflare Workers

The web app deploys as a **Worker**, not a static export: `middleware.ts`
resolves the tenant from the request hostname and enforces auth on every
request, and several routes render on demand — a static export would drop all
of that.

The adapter is [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare),
which compiles the Next.js server output into a Worker plus a static asset
bundle.

## Files

| File | Purpose |
|---|---|
| `apps/web/open-next.config.ts` | OpenNext adapter config; serves prerendered pages from the Worker's static assets (KV is an opt-in switch) |
| `apps/web/wrangler.jsonc` | Worker name, entrypoint, compatibility flags, asset binding, vars |
| `.github/workflows/deploy-cloudflare.yml` | Typecheck, build and deploy on push to `main`, or on demand |

## One-time setup

1. **Create an API token** at <https://dash.cloudflare.com/profile/api-tokens>
   using the *Edit Cloudflare Workers* template. It needs:
   - Account → Workers Scripts → Edit
   - Account → Workers KV Storage → Edit (only if you enable the KV cache)
   - Zone → Workers Routes → Edit (only if you attach a custom domain)

2. **Add repository secrets** (Settings → Secrets and variables → Actions):
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID` — shown in the Workers & Pages sidebar

3. **Add repository variables**:
   - `NEXT_PUBLIC_SITE_URL` — the public origin, e.g. `https://cofounderbay.com`.
     It drives `metadataBase`, canonical URLs, `robots.txt` and `sitemap.xml`,
     so in production it must be the real origin.
   - `NEXT_PUBLIC_API_URL` — the NestJS API origin. It is also interpolated into
     the `connect-src` CSP directive in `next.config.ts`, so a wrong value here
     blocks the app's own API calls in the browser.

4. **(Optional) Cache the revalidating routes in KV**. By default the
   incremental cache is the read-only static-assets cache: prerendered pages
   come from the Worker's own assets and nothing else is needed. The routes
   that revalidate (`/profiles/[userId]`, `/org/[slug]`, the Open Graph
   fetches of the shareable layouts) then render fresh on every request. To
   cache them:
   ```bash
   cd apps/web
   npx wrangler kv namespace create NEXT_INC_CACHE_KV
   ```
   Paste the returned id into the commented `kv_namespaces` block in
   `wrangler.jsonc` **and** switch the import in `open-next.config.ts` to
   `kv-incremental-cache`. Do both or neither: with the KV import and no
   binding, `opennextjs-cloudflare deploy` stops at
   `No KV binding "NEXT_INC_CACHE_KV" found!` (the first deploy from `main`,
   run 37736389279, failed exactly there).

5. **Plan size**. The worker is about 8.3 MiB gzipped (41 MiB raw) for 153
   prerendered pages and the dynamic routes. Cloudflare accepts at most 3 MiB
   on the Workers Free plan and 10 MiB on Workers Paid, so the account needs
   Workers Paid. `pnpm exec wrangler deploy --dry-run --outdir /tmp/w` in
   `apps/web` after `pnpm run cf:build` prints the current figure.

## Deploying by hand

```bash
cd apps/web

pnpm run cf:build      # build the worker bundle
pnpm run cf:preview    # build, then run it locally on workerd (the real runtime)

npx wrangler login     # or export CLOUDFLARE_API_TOKEN=...
pnpm run cf:deploy     # build and ship
```

The first deploy prints the `*.workers.dev` URL.

## Verified locally

The bundle builds and boots on workerd. Against `wrangler dev`:

| Check | Result |
|---|---|
| `/` | 200 |
| `/pricing` | 200 |
| `/robots.txt`, `/sitemap.xml` | 200, correct contents |
| `/dashboard` unauthenticated | 307 → `/login?redirect=%2Fdashboard` — the auth middleware runs on the edge |
| Security headers | CSP, Permissions-Policy, COOP, CORP, HSTS and `Referrer-Policy: strict-origin-when-cross-origin` all present on the response |
| Metadata | OpenGraph and Twitter cards rendered; viewport carries no zoom lock |
| Fonts | Inter and Space Grotesk served from our own origin with fallback metrics |

## Multi-tenant note

`middleware.ts` derives the tenant slug from the request hostname
(`athens.cofounderbay.com` → `athens`). For that to work the Worker must receive
the real `Host` header, so attach a wildcard route (`*.cofounderbay.com/*`)
rather than relying on `*.workers.dev`, where every request arrives on the same
hostname and no tenant is ever resolved.
