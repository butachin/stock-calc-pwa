import { buildRealtimeChartResponse } from '../api/chart.js'

function attachChartMiddleware(middlewares) {
  middlewares.use('/api/chart', async (req, res) => {
    try {
      const reqUrl = new URL(req.url || '', 'http://localhost')
      const symbol = reqUrl.searchParams.get('symbol') || '7011.T'
      const interval = reqUrl.searchParams.get('interval') || '5m'
      const range = reqUrl.searchParams.get('range') || '1d'

      const result = await buildRealtimeChartResponse({
        symbol,
        interval,
        range,
      })
      res.statusCode = result.status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, max-age=0'
      )
      res.end(JSON.stringify(result.body))
    } catch (err) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      )
    }
  })
}

export function localChartApiPlugin() {
  return {
    name: 'local-chart-api',
    configureServer(server) {
      attachChartMiddleware(server.middlewares)
    },
    configurePreviewServer(server) {
      attachChartMiddleware(server.middlewares)
    },
  }
}
