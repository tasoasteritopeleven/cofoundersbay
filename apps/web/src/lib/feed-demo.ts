import type { FeedPost } from '@/lib/api';

/**
 * Posts the reader has written, kept for the session.
 *
 * The composer showed "Post published!" and published nothing — there is no
 * feed module in the API at all, so `/api/feed/*` is served only by the
 * browser's demo shim. A success toast over a post that never existed is worse
 * than a disabled composer: it tells someone their words are somewhere they
 * are not.
 *
 * This follows the convention the product already uses for a demo that writes
 * (`fundraising-demo`, `readiness-demo`): a `sessionStorage` overlay under a
 * `cfb:demo-` key, merged over whatever the feed returns. `sessionStorage`
 * rather than `localStorage` for the same reason as the others — a post that
 * survived into next week would be indistinguishable from one the platform had
 * really stored.
 */

const STORAGE_KEY = 'cfb:demo-feed';

export function readComposedPosts(): FeedPost[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Anything without the two fields the list keys and renders on is dropped
    // rather than rendered half-formed.
    return parsed.filter(
      (post): post is FeedPost =>
        !!post && typeof post === 'object'
        && typeof (post as FeedPost).id === 'string'
        && typeof (post as FeedPost).content === 'string',
    );
  } catch {
    return [];
  }
}

function write(posts: FeedPost[]): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  } catch {
    /* a blocked write costs persistence, not the post appearing on screen */
  }
}

/** Newest first, the way the composer's output should read. */
export function addComposedPost(input: {
  content: string;
  type: FeedPost['type'];
  author: FeedPost['author'];
}): FeedPost[] {
  const post: FeedPost = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    author: input.author,
    type: input.type,
    content: input.content,
    likes: 0,
    comments: 0,
    shares: 0,
    isLiked: false,
    isBookmarked: false,
    createdAt: new Date().toISOString(),
  };
  const next = [post, ...readComposedPosts()];
  write(next);
  return next;
}

export function clearComposedPosts(): FeedPost[] {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to clear if it could not be written */
    }
  }
  return [];
}
