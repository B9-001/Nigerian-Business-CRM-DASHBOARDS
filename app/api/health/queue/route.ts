import { NextResponse } from 'next/server'

export async function GET() {
  if (!process.env.REDIS_URL) {
    return NextResponse.json({ status: 'not_configured' })
  }

  try {
    const { Redis } = await import('ioredis')
    const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 2000, maxRetriesPerRequest: 1 })
    const start = Date.now()
    await redis.connect()
    await redis.ping()
    const latencyMs = Date.now() - start
    redis.disconnect()
    return NextResponse.json({ status: 'ok', latencyMs })
  } catch (err) {
    return NextResponse.json({ status: 'down', error: String(err) }, { status: 503 })
  }
}
