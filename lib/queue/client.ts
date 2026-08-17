import 'server-only'
import { Queue } from 'bullmq'
import Redis from 'ioredis'

const PREFIX = process.env.QUEUE_PREFIX ?? 'nbos'

/**
 * A queue that degrades to a console-warning no-op when REDIS_URL isn't
 * configured, so importing this module never crashes local dev (or a
 * Vercel build) without Redis. In production, set REDIS_URL and this
 * becomes a real BullMQ queue backed by it.
 */
interface QueueLike {
  add: (name: string, data: unknown, opts?: Record<string, unknown>) => Promise<unknown>
}

function createQueue(name: string): QueueLike {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    return {
      async add(jobName: string) {
        console.warn(`[queue:${name}] REDIS_URL not configured — job "${jobName}" was not enqueued.`)
        return null
      },
    }
  }

  try {
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null })
    const queue = new Queue(name, { connection, prefix: PREFIX })
    return queue
  } catch (err) {
    console.error(`[queue:${name}] failed to initialize BullMQ queue, falling back to no-op`, err)
    return {
      async add(jobName: string) {
        console.warn(`[queue:${name}] queue unavailable — job "${jobName}" was not enqueued.`)
        return null
      },
    }
  }
}

export const aiResearchQueue = createQueue('ai-research')
export const aiReportQueue = createQueue('ai-report')
export const documentProcessingQueue = createQueue('document-processing')
export const meetingSummaryQueue = createQueue('meeting-summary')
export const emailQueue = createQueue('email')
export const notificationQueue = createQueue('notification')
export const webhookDeliveryQueue = createQueue('webhook-delivery')
export const analyticsQueue = createQueue('analytics')
