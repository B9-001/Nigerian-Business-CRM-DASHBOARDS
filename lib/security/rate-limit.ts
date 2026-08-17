import 'server-only'

/**
 * Fixed-window rate limiter, Redis-backed with an in-memory fallback so
 * local dev works without Redis running. Organization/user/IP-aware —
 * callers build the key (see usage in AI routes, public API, widget).
 *
 * Swap `memoryStore` for the Redis-backed implementation in production by
 * ensuring REDIS_URL is set; ioredis is already a dependency for BullMQ.
 */

type Bucket = { count: number; resetAt: number }
const memoryStore = new Map<string, Bucket>()

let redisClient: import('ioredis').Redis | null | undefined

async function getRedis() {
  if (redisClient !== undefined) return redisClient
  if (!process.env.REDIS_URL) {
    redisClient = null
    return redisClient
  }
  try {
    const { Redis } = await import('ioredis')
    redisClient = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
    await redisClient.connect().catch(() => {
      redisClient = null
    })
  } catch {
    redisClient = null
  }
  return redisClient
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * @param key         unique bucket key, e.g. `ai-research:${orgId}:${userId}`
 * @param limit       max requests allowed in the window
 * @param windowMs    window size in milliseconds
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const redis = await getRedis()
  const now = Date.now()

  if (redis) {
    const redisKey = `ratelimit:${key}`
    const count = await redis.incr(redisKey)
    if (count === 1) {
      await redis.pexpire(redisKey, windowMs)
    }
    const ttl = await redis.pttl(redisKey)
    const resetAt = now + (ttl > 0 ? ttl : windowMs)
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt }
  }

  // In-memory fallback (single-instance dev only — not safe across
  // multiple serverless instances in production without Redis configured).
  const existing = memoryStore.get(key)
  if (!existing || existing.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  existing.count += 1
  return { allowed: existing.count <= limit, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt }
}

/** Common named limits (CLAUDE.md #37). Tune per-plan via organization entitlements later. */
export const RATE_LIMITS = {
  LOGIN: { limit: 5, windowMs: 60_000 },
  AI_CHAT: { limit: 20, windowMs: 60_000 },
  AI_RESEARCH: { limit: 10, windowMs: 60_000 },
  PUBLIC_API: { limit: 60, windowMs: 60_000 },
  WIDGET: { limit: 30, windowMs: 60_000 },
  WEBHOOK_INBOUND: { limit: 120, windowMs: 60_000 },
  FILE_UPLOAD: { limit: 10, windowMs: 60_000 },
  PASSWORD_RESET: { limit: 3, windowMs: 300_000 },
  SEARCH: { limit: 30, windowMs: 60_000 },
} as const
