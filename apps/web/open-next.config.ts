import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import incrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

/**
 * OpenNext adapter config for Cloudflare Workers.
 *
 * The Next.js app is fully server-capable (middleware does tenant resolution
 * and auth on every request), so it is deployed as a Worker rather than as a
 * static export.
 *
 * `incrementalCache` serves the prerendered pages from the Worker's own static
 * assets (`ASSETS`, already bound in wrangler.jsonc), so a deploy needs no
 * extra Cloudflare resource. It is read-only: the few routes that revalidate
 * (`/profiles/[userId]`, `/org/[slug]` and the Open Graph fetches of the
 * shareable layouts) render fresh on every request instead of being cached.
 *
 * To cache those between requests, switch to Workers KV: create the namespace
 * (`npx wrangler kv namespace create NEXT_INC_CACHE_KV`), uncomment the
 * `kv_namespaces` block in wrangler.jsonc with its id, and import
 * `@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache`
 * here instead. Not before: `opennextjs-cloudflare deploy` populates the KV
 * cache and stops with `No KV binding "NEXT_INC_CACHE_KV" found!` when the
 * binding is missing, which is how the first deploy from `main` failed.
 */
export default defineCloudflareConfig({
  incrementalCache,
});
