/**
 * Analytics worker — lowest-priority background job. Placeholder for
 * periodically refreshing cached dashboard aggregates (e.g. a materialized
 * view or Redis-cached summary) once the dashboard needs to serve numbers
 * faster than a live `dashboard_summary()` RPC call. Not required for
 * correctness today — dashboard_summary() is cheap enough to call live.
 */
const INTERVAL_MS = 10 * 60_000

async function refreshAggregates() {
  // TODO: once a materialized view (e.g. mv_dashboard_summary) or a cache
  // layer (lib/cache) exists, refresh it here per organization.
  console.log('[worker:analytics] tick (no-op placeholder)')
}

function startWorker() {
  console.log('[worker:analytics] started, running every', INTERVAL_MS, 'ms')
  setInterval(refreshAggregates, INTERVAL_MS)
}

startWorker()
