import crypto from 'node:crypto'
import tls from 'node:tls'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const JST_OFFSET_SEC = 9 * 3600

function getJstParts(unixSec) {
  const d = new Date((unixSec + JST_OFFSET_SEC) * 1000)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return {
    dateStr: `${yyyy}-${mm}-${dd}`,
    timeStr: `${hh}:${min}`,
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  }
}

function jstYmdHmToUnixSec(year, month1Based, day, hour, minute) {
  return Math.floor(
    Date.UTC(year, month1Based - 1, day, hour ?? 0, minute ?? 0, 0) / 1000 -
      JST_OFFSET_SEC
  )
}

function parseJstIsoDateToUnixSec(isoStr) {
  if (!isoStr || typeof isoStr !== 'string' || isoStr === '$undefined') {
    return null
  }
  const ms = Date.parse(isoStr)
  if (!Number.isFinite(ms)) return null
  return Math.floor(ms / 1000)
}

function parseYjpNumber(raw) {
  if (raw === null || raw === undefined) return null
  const s = String(raw).replace(/[,¥円株%\s]/g, '').trim()
  if (!s || s === '---' || s === '--' || s === '$undefined') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function cleanCompanyName(rawName) {
  if (!rawName || typeof rawName !== 'string') return undefined
  const cleaned = rawName
    .replace(/^\(株\)\s*|\s*\(株\)$/g, '')
    .replace(/^（株）\s*|\s*（株）$/g, '')
    .trim()
  return cleaned || rawName.trim()
}

function extractBalancedObject(str, startIdx) {
  if (startIdx < 0 || startIdx >= str.length || str[startIdx] !== '{') {
    return null
  }
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = startIdx; i < str.length; i++) {
    const ch = str[i]
    if (esc) {
      esc = false
      continue
    }
    if (inStr) {
      if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(str.slice(startIdx, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

// ============================================================================
// Source 1: Yahoo! Finance Japan SSR (Zero-delay real-time price + official VWAP + PTS)
// ============================================================================
async function fetchYahooJapanQuote(yjpSymbol) {
  try {
    const res = await fetch(
      `https://finance.yahoo.co.jp/quote/${encodeURIComponent(yjpSymbol)}`,
      {
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(3500),
      }
    )
    if (!res.ok) return null
    const html = await res.text()

    const chunks = []
    const re = /self\.__next_f\.push\(\[\d+,"((?:[^"\\]|\\.)*)"\]\)/g
    let m
    while ((m = re.exec(html)) !== null) {
      try {
        chunks.push(JSON.parse(`"${m[1]}"`))
      } catch {
        // ignore malformed chunk
      }
    }
    if (chunks.length === 0) return null
    const joined = chunks.join('\n')

    let priceBoard = null
    let searchFrom = 0
    while (searchFrom < joined.length) {
      const idx = joined.indexOf('"priceBoard":{', searchFrom)
      if (idx === -1) break
      const obj = extractBalancedObject(
        joined,
        idx + '"priceBoard":'.length
      )
      if (obj?.board) {
        priceBoard = obj
        break
      }
      searchFrom = idx + 12
    }

    let detailData = null
    searchFrom = 0
    while (searchFrom < joined.length) {
      const idx = joined.indexOf('"detailData":{', searchFrom)
      if (idx === -1) break
      const obj = extractBalancedObject(
        joined,
        idx + '"detailData":'.length
      )
      if (obj?.indicators) {
        detailData = obj
        break
      }
      searchFrom = idx + 12
    }

    const board = priceBoard?.board
    const indicators = detailData?.indicators
    if (!board && !indicators) return null

    const price = parseYjpNumber(board?.price?.value)
    const previousClose = parseYjpNumber(indicators?.previousPrice?.value)
    const open = parseYjpNumber(indicators?.openPrice?.value)
    const high = parseYjpNumber(indicators?.highPrice?.value)
    const low = parseYjpNumber(indicators?.lowPrice?.value)
    const volume = parseYjpNumber(indicators?.volume?.value)
    const tradingValueThousand = parseYjpNumber(indicators?.tradingValue?.value)
    const tradingValueYen =
      tradingValueThousand !== null ? tradingValueThousand * 1000 : null

    const officialVwap =
      volume !== null && volume > 0 && tradingValueYen !== null && tradingValueYen > 0
        ? Math.round((tradingValueYen / volume) * 10) / 10
        : null

    const openMeta = indicators?.openPrice?.updateDateMeta
    const volMeta = indicators?.volume?.updateDateMeta
    const totalMeta = indicators?.totalPrice?.updateDateMeta
    const sessionDateCandidate =
      [openMeta, volMeta, totalMeta].find(
        (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s)
      ) || null
    const sessionDate = sessionDateCandidate
      ? sessionDateCandidate.slice(0, 10)
      : null

    const japanUpdateTime =
      typeof board?.japanUpdateTime === 'string'
        ? board.japanUpdateTime.trim()
        : null

    let liveTimestampSec = null
    if (
      japanUpdateTime &&
      /^\d{1,2}:\d{2}$/.test(japanUpdateTime) &&
      sessionDate
    ) {
      const [y, mo, d] = sessionDate.split('-').map(Number)
      const [h, mi] = japanUpdateTime.split(':').map(Number)
      liveTimestampSec = jstYmdHmToUnixSec(y, mo, d, h, mi)
    } else {
      liveTimestampSec =
        parseJstIsoDateToUnixSec(volMeta) ||
        parseJstIsoDateToUnixSec(totalMeta) ||
        parseJstIsoDateToUnixSec(openMeta)
    }

    const openTimestamp = parseJstIsoDateToUnixSec(openMeta)

    return {
      name: cleanCompanyName(board?.name),
      price,
      previousClose,
      open,
      high,
      low,
      volume,
      officialVwap,
      delayMinutes:
        typeof board?.delayMinutes === 'number' ? board.delayMinutes : 0,
      japanUpdateTime,
      sessionDate,
      liveTimestampSec,
      openTimestamp,
      ptsPrice: parseYjpNumber(board?.ptsPrice),
      ptsPriceChange: parseYjpNumber(board?.ptsPriceChange),
      ptsPriceChangeRate: parseYjpNumber(board?.ptsPriceChangeRate),
      ptsUpdateTime:
        typeof board?.ptsUpdateTime === 'string'
          ? board.ptsUpdateTime.trim()
          : null,
    }
  } catch {
    return null
  }
}

// ============================================================================
// Source 2: TradingView WebSocket (Full TSE 09:00〜15:30 1m/5m/15m OHLCV bars)
// ============================================================================
function fetchTradingViewBars(tvSymbol, resolution, count) {
  return new Promise((resolve) => {
    const key = crypto.randomBytes(16).toString('base64')
    const session = `cs_${Math.random().toString(36).slice(2, 10)}`
    let settled = false
    let handshakeDone = false
    let buf = Buffer.alloc(0)
    let textCarry = ''
    let fragmentBuffers = []
    let fragmentOpcode = null

    const socket = tls.connect(443, 'data.tradingview.com', {
      servername: 'data.tradingview.com',
    })

    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        socket.destroy()
      } catch {
        // ignore
      }
      resolve(result)
    }

    const timer = setTimeout(() => finish(null), 4000)

    const sendWsFrame = (text, opcode = 0x1) => {
      if (settled || socket.destroyed) return
      const payload = Buffer.from(text, 'utf8')
      const mask = crypto.randomBytes(4)
      let header
      if (payload.length < 126) {
        header = Buffer.from([0x80 | opcode, 0x80 | payload.length])
      } else if (payload.length < 65536) {
        header = Buffer.alloc(4)
        header[0] = 0x80 | opcode
        header[1] = 0x80 | 126
        header.writeUInt16BE(payload.length, 2)
      } else {
        header = Buffer.alloc(10)
        header[0] = 0x80 | opcode
        header[1] = 0x80 | 127
        header.writeBigUInt64BE(BigInt(payload.length), 2)
      }
      const masked = Buffer.alloc(payload.length)
      for (let i = 0; i < payload.length; i++) {
        masked[i] = payload[i] ^ mask[i & 3]
      }
      socket.write(Buffer.concat([header, mask, masked]))
    }

    const sendTv = (m, p) => {
      const s = JSON.stringify({ m, p })
      sendWsFrame(`~m~${s.length}~m~${s}`)
    }

    const processMessageText = (text) => {
      textCarry += text
      while (textCarry.startsWith('~m~')) {
        const m = /^~m~(\d+)~m~/.exec(textCarry)
        if (!m) break
        const bodyLen = Number(m[1])
        const start = m[0].length
        if (textCarry.length < start + bodyLen) break
        const body = textCarry.slice(start, start + bodyLen)
        textCarry = textCarry.slice(start + bodyLen)

        if (body.startsWith('~h~')) {
          sendWsFrame(`~m~${body.length}~m~${body}`)
        } else if (body.startsWith('{')) {
          try {
            const msg = JSON.parse(body)
            if (msg.m === 'symbol_error' || msg.m === 'series_error') {
              finish(null)
              return
            }
            if (msg.m === 'timescale_update') {
              const rawBars = msg.p?.[1]?.sds_1?.s
              if (Array.isArray(rawBars) && rawBars.length > 0) {
                const bars = rawBars
                  .map((b) => b?.v)
                  .filter(
                    (v) =>
                      Array.isArray(v) &&
                      v.length >= 5 &&
                      Number.isFinite(v[0]) &&
                      Number.isFinite(v[4])
                  )
                  .map((v) => ({
                    ts: Math.round(v[0]),
                    o: v[1] ?? v[4],
                    h: v[2] ?? v[4],
                    l: v[3] ?? v[4],
                    c: v[4],
                    v: Number.isFinite(v[5]) ? Math.max(0, v[5]) : 0,
                  }))
                  .sort((a, b) => a.ts - b.ts)
                if (bars.length > 0) {
                  finish(bars)
                  return
                }
              }
            }
          } catch {
            // ignore non-critical message
          }
        }
      }
    }

    socket.on('connect', () => {
      socket.write(
        'GET /socket.io/websocket HTTP/1.1\r\n' +
          'Host: data.tradingview.com\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          'Origin: https://www.tradingview.com\r\n' +
          `User-Agent: ${UA}\r\n` +
          `Sec-WebSocket-Key: ${key}\r\n` +
          'Sec-WebSocket-Version: 13\r\n\r\n'
      )
    })

    socket.on('data', (chunk) => {
      if (settled) return
      buf = Buffer.concat([buf, chunk])

      if (!handshakeDone) {
        const hdrEnd = buf.indexOf('\r\n\r\n')
        if (hdrEnd === -1) return
        const head = buf.slice(0, hdrEnd).toString('utf8')
        if (!head.includes('101')) {
          finish(null)
          return
        }
        buf = buf.slice(hdrEnd + 4)
        handshakeDone = true
        sendTv('set_auth_token', ['unauthorized_user_token'])
        sendTv('chart_create_session', [session, ''])
        sendTv('resolve_symbol', [
          session,
          'sds_sym_1',
          `=${JSON.stringify({
            symbol: tvSymbol,
            adjustment: 'splits',
            session: 'regular',
          })}`,
        ])
        sendTv('create_series', [
          session,
          'sds_1',
          's1',
          'sds_sym_1',
          resolution,
          count,
        ])
      }

      while (buf.length >= 2) {
        const b0 = buf[0]
        const b1 = buf[1]
        const fin = (b0 & 0x80) !== 0
        const opcode = b0 & 0x0f
        const isMasked = (b1 & 0x80) !== 0
        let len = b1 & 0x7f
        let off = 2

        if (len === 126) {
          if (buf.length < 4) break
          len = buf.readUInt16BE(2)
          off = 4
        } else if (len === 127) {
          if (buf.length < 10) break
          len = Number(buf.readBigUInt64BE(2))
          off = 10
        }

        const maskLen = isMasked ? 4 : 0
        const total = off + maskLen + len
        if (buf.length < total) break

        let payload = buf.slice(off + maskLen, total)
        if (isMasked) {
          const maskKey = buf.slice(off, off + 4)
          payload = Buffer.from(payload)
          for (let i = 0; i < payload.length; i++) {
            payload[i] ^= maskKey[i & 3]
          }
        }
        buf = buf.slice(total)

        if (opcode === 0x8) {
          finish(null)
          return
        }
        if (opcode === 0x9) {
          sendWsFrame(payload, 0xa)
          continue
        }
        if (opcode === 0xa) continue

        if (opcode === 0x1 || opcode === 0x2) {
          if (fin) {
            processMessageText(payload.toString('utf8'))
          } else {
            fragmentOpcode = opcode
            fragmentBuffers = [payload]
          }
        } else if (opcode === 0x0 && fragmentOpcode !== null) {
          fragmentBuffers.push(payload)
          if (fin) {
            const combined = Buffer.concat(fragmentBuffers)
            fragmentBuffers = []
            fragmentOpcode = null
            processMessageText(combined.toString('utf8'))
          }
        }
      }
    })

    socket.on('error', () => finish(null))
    socket.on('close', () => finish(null))
  })
}

// ============================================================================
// Source 3: Google Finance Fallback (1m & 5m HTTP intraday series up to 15:00)
// ============================================================================
function extractGfinDataset(html, key) {
  const marker = `key: '${key}'`
  const idx = html.indexOf(marker)
  if (idx === -1) return null
  const dataIdx = html.indexOf('data:', idx)
  if (dataIdx === -1) return null
  const afterData = html.slice(dataIdx + 5)
  const sideMatch = /,\s*sideChannel:/.exec(afterData)
  if (!sideMatch) return null
  try {
    return JSON.parse(afterData.slice(0, sideMatch.index))
  } catch {
    return null
  }
}

function aggregateBars(bars, bucketSeconds) {
  const buckets = new Map()
  for (const b of bars) {
    const key =
      Math.floor((b.ts + JST_OFFSET_SEC) / bucketSeconds) * bucketSeconds -
      JST_OFFSET_SEC
    const existing = buckets.get(key)
    if (!existing) {
      buckets.set(key, {
        ts: key,
        o: b.o,
        h: b.h,
        l: b.l,
        c: b.c,
        v: b.v,
      })
    } else {
      existing.h = Math.max(existing.h, b.h)
      existing.l = Math.min(existing.l, b.l)
      existing.c = b.c
      existing.v += b.v
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts)
}

async function fetchGoogleFinance(gfinSymbol, interval) {
  try {
    const res = await fetch(
      `https://www.google.com/finance/quote/${encodeURIComponent(gfinSymbol)}`,
      {
        headers: { 'User-Agent': UA, 'Accept-Language': 'ja,en;q=0.9' },
        signal: AbortSignal.timeout(3500),
      }
    )
    if (!res.ok) return null
    const html = await res.text()

    const ds2 = extractGfinDataset(html, 'ds:2')
    const ds9 = extractGfinDataset(html, 'ds:9')
    const ds10 = extractGfinDataset(html, 'ds:10')

    const previousClose = ds2?.[0]?.[0]?.[7] ?? null
    const latestPrice = ds2?.[0]?.[0]?.[5]?.[0] ?? null
    const latestTs = ds2?.[0]?.[0]?.[17]?.[0] ?? null
    const name = ds2?.[0]?.[0]?.[2] ?? undefined

    const bars1m = []
    const sessions9 = ds9?.[0]?.[0]?.[3]
    if (Array.isArray(sessions9)) {
      for (const sess of sessions9) {
        const pts = sess?.[1]
        if (!Array.isArray(pts)) continue
        for (const pt of pts) {
          const dt = pt?.[0]
          const price = pt?.[1]?.[0]
          const vol = pt?.[2] ?? 0
          if (!Array.isArray(dt) || dt.length < 4 || !Number.isFinite(price)) {
            continue
          }
          const ts = jstYmdHmToUnixSec(
            dt[0],
            dt[1],
            dt[2],
            dt[3] ?? 0,
            dt[4] ?? 0
          )
          bars1m.push({
            ts,
            o: price,
            h: price,
            l: price,
            c: price,
            v: Number.isFinite(vol) ? Math.max(0, vol) : 0,
          })
        }
      }
    }

    const bars5m = []
    const sessions10 = ds10?.[0]?.[0]?.[3]
    if (Array.isArray(sessions10)) {
      for (const sess of sessions10) {
        const candles = sess?.[2]
        if (!Array.isArray(candles)) continue
        for (const c of candles) {
          if (!Array.isArray(c) || c.length < 5) continue
          const ts = parseJstIsoDateToUnixSec(c[4])
          const close = c[1]
          if (!ts || !Number.isFinite(close)) continue
          bars5m.push({
            ts,
            o: c[0] ?? close,
            h: c[2] ?? close,
            l: c[3] ?? close,
            c: close,
            v: Number.isFinite(c[5]) ? Math.max(0, c[5]) : 0,
          })
        }
      }
    }

    let chosen = []
    if (interval === '1m') {
      chosen = bars1m.length > 0 ? bars1m : bars5m
    } else if (interval === '5m') {
      chosen =
        bars5m.length > 0
          ? bars5m
          : bars1m.length > 0
          ? aggregateBars(bars1m, 300)
          : []
    } else {
      // 15m
      const base = bars1m.length > 0 ? bars1m : bars5m
      chosen = base.length > 0 ? aggregateBars(base, 900) : []
    }

    chosen.sort((a, b) => a.ts - b.ts)
    if (chosen.length === 0 && !Number.isFinite(latestPrice)) return null

    return {
      bars: chosen,
      previousClose: Number.isFinite(previousClose) ? previousClose : null,
      latestPrice: Number.isFinite(latestPrice) ? latestPrice : null,
      latestTs: Number.isFinite(latestTs) ? latestTs : null,
      name,
    }
  } catch {
    return null
  }
}

// ============================================================================
// Source 4: Yahoo Finance US v8 fallback (non-TSE tickers or emergency fallback)
// ============================================================================
async function fetchYahooV8Fallback(yahooSymbol, interval, range) {
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(
        yahooSymbol
      )}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(
        range
      )}&includePrePost=false`
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) continue
      const json = await res.json()
      const r = json?.chart?.result?.[0]
      if (r?.timestamp?.length) return json
    } catch {
      // try next host
    }
  }
  return null
}

// ============================================================================
// Main Unified Handler
// ============================================================================
export async function buildRealtimeChartResponse({
  symbol = '7011.T',
  interval = '5m',
  range = '1d',
}) {
  const cleanSymbol = String(symbol).trim().toUpperCase()
  const baseNoSuffix = cleanSymbol.endsWith('.T')
    ? cleanSymbol.slice(0, -2)
    : cleanSymbol
  const isTse =
    cleanSymbol.endsWith('.T') ||
    /^\d{4}$/.test(cleanSymbol) ||
    /^\d{3}[A-Z]$/.test(cleanSymbol)

  const normalizedInterval =
    interval === '1m' || interval === '5m' || interval === '15m'
      ? interval
      : '5m'
  const tvRes =
    normalizedInterval === '1m'
      ? '1'
      : normalizedInterval === '5m'
      ? '5'
      : '15'
  const tvCount =
    normalizedInterval === '1m' ? 420 : normalizedInterval === '5m' ? 140 : 60

  const yahooSymbol = isTse ? `${baseNoSuffix}.T` : cleanSymbol
  const tvSymbol = isTse ? `TSE:${baseNoSuffix}` : cleanSymbol
  const gfinSymbol = isTse ? `${baseNoSuffix}:TYO` : cleanSymbol

  // Fetch all authoritative sources concurrently
  const [tvResult, yjpResult, gfinResult] = await Promise.allSettled([
    fetchTradingViewBars(tvSymbol, tvRes, tvCount),
    isTse ? fetchYahooJapanQuote(yahooSymbol) : Promise.resolve(null),
    isTse
      ? fetchGoogleFinance(gfinSymbol, normalizedInterval)
      : Promise.resolve(null),
  ])

  const tvBars = tvResult.status === 'fulfilled' ? tvResult.value : null
  const yjp = yjpResult.status === 'fulfilled' ? yjpResult.value : null
  const gfin = gfinResult.status === 'fulfilled' ? gfinResult.value : null

  let sourceLabel = ''
  let rawBars = []
  if (Array.isArray(tvBars) && tvBars.length > 0) {
    rawBars = tvBars
    sourceLabel = 'tv'
  } else if (gfin?.bars?.length) {
    rawBars = gfin.bars
    sourceLabel = 'gfin'
  }

  // Fallback for US stocks or when both TV & Google Finance returned nothing
  if (rawBars.length === 0 && (!isTse || !yjp?.price)) {
    const yahooJson = await fetchYahooV8Fallback(
      yahooSymbol,
      normalizedInterval,
      range
    )
    if (yahooJson) {
      return { status: 200, body: { ok: true, data: yahooJson } }
    }
    return {
      status: 404,
      body: {
        ok: false,
        error: `No real-time market data found for ${yahooSymbol}`,
      },
    }
  }

  // Filter historical bars to the latest session date in JST
  let barSessionDate = null
  let prevDayClose = null
  let sessionBars = []

  if (rawBars.length > 0) {
    const tagged = rawBars.map((b) => ({
      ...b,
      day: getJstParts(b.ts).dateStr,
    }))
    barSessionDate = tagged[tagged.length - 1].day
    const earlierBars = tagged.filter((b) => b.day < barSessionDate)
    if (earlierBars.length > 0) {
      prevDayClose = earlierBars[earlierBars.length - 1].c
    }
    sessionBars = tagged
      .filter((b) => b.day === barSessionDate)
      .map(({ ts, o, h, l, c, v }) => ({ ts, o, h, l, c, v }))
  }

  let effectiveSessionDate = barSessionDate || yjp?.sessionDate || null
  let lastDelayedBarTimestamp =
    sessionBars.length > 0 ? sessionBars[sessionBars.length - 1].ts : null
  let isRealtimePatched = false
  let isEarlySession = false
  let finalBars = sessionBars.map((b) => ({
    ...b,
    tpOverride: (b.h + b.l + b.c) / 3,
  }))

  // Integrate Yahoo! Finance Japan 0-delay live quote onto delayed chart series
  if (yjp && yjp.price !== null && yjp.price > 0) {
    sourceLabel = sourceLabel ? `${sourceLabel}+yjp` : 'yjp'

    const isYjpNewerDay =
      Boolean(yjp.sessionDate) &&
      (!barSessionDate || yjp.sessionDate > barSessionDate)

    if (isYjpNewerDay) {
      // Market just opened today (e.g. 09:00〜09:19 JST) while delayed bars still reflect previous trading day
      effectiveSessionDate = yjp.sessionDate
      lastDelayedBarTimestamp = null
      isEarlySession = true
      isRealtimePatched = true

      const openPrice = yjp.open ?? yjp.price
      const totalVol = yjp.volume ?? 0
      const liveTs =
        yjp.liveTimestampSec || yjp.openTimestamp || Math.floor(Date.now() / 1000)

      if (
        yjp.open !== null &&
        yjp.openTimestamp &&
        liveTs > yjp.openTimestamp + 30
      ) {
        const openSeedVol = totalVol > 0 ? Math.round(totalVol * 0.25) : 0
        const remVol = Math.max(0, totalVol - openSeedVol)
        const baseLo = Math.min(openPrice, yjp.low ?? yjp.price, yjp.price)
        const baseHi = Math.max(openPrice, yjp.high ?? yjp.price, yjp.price)
        let impliedTp = (baseHi + baseLo + yjp.price) / 3
        if (yjp.officialVwap && totalVol > 0 && remVol > 0) {
          const calcTp =
            (yjp.officialVwap * totalVol - openPrice * openSeedVol) / remVol
          impliedTp = Math.max(baseLo * 0.995, Math.min(baseHi * 1.005, calcTp))
        }
        finalBars = [
          {
            ts: yjp.openTimestamp,
            o: openPrice,
            h: openPrice,
            l: openPrice,
            c: openPrice,
            v: openSeedVol,
            tpOverride: openPrice,
          },
          {
            ts: liveTs,
            o: openPrice,
            h: yjp.high ?? Math.max(openPrice, yjp.price),
            l: yjp.low ?? Math.min(openPrice, yjp.price),
            c: yjp.price,
            v: remVol,
            tpOverride: impliedTp,
          },
        ]
      } else {
        finalBars = [
          {
            ts: liveTs,
            o: openPrice,
            h: yjp.high ?? yjp.price,
            l: yjp.low ?? yjp.price,
            c: yjp.price,
            v: totalVol,
            tpOverride: yjp.officialVwap ?? yjp.price,
          },
        ]
      }
    } else if (finalBars.length > 0) {
      // Same trading session: patch 0-delay Yahoo Japan current price / closing auction onto delayed bars
      const lastBar = finalBars[finalBars.length - 1]
      const barSumVol = finalBars.reduce((acc, b) => acc + b.v, 0)
      const barSumPV = finalBars.reduce((acc, b) => acc + b.tpOverride * b.v, 0)
      const liveTs = yjp.liveTimestampSec

      if (liveTs && liveTs > lastBar.ts + 30) {
        const deltaVol =
          yjp.volume !== null && yjp.volume > barSumVol
            ? yjp.volume - barSumVol
            : 0
        let impliedTp = yjp.price
        if (yjp.officialVwap && yjp.volume && yjp.volume > 0 && deltaVol > 0) {
          const rawImplied =
            (yjp.officialVwap * yjp.volume - barSumPV) / deltaVol
          const loBound =
            Math.min(yjp.low ?? yjp.price, lastBar.l, yjp.price) * 0.995
          const hiBound =
            Math.max(yjp.high ?? yjp.price, lastBar.h, yjp.price) * 1.005
          impliedTp = Math.max(loBound, Math.min(hiBound, rawImplied))
        }
        finalBars.push({
          ts: liveTs,
          o: lastBar.c,
          h: Math.max(lastBar.c, yjp.price),
          l: Math.min(lastBar.c, yjp.price),
          c: yjp.price,
          v: deltaVol,
          tpOverride: impliedTp,
        })
        isRealtimePatched = true
      } else if (!liveTs || Math.abs(liveTs - lastBar.ts) <= 60) {
        lastBar.c = yjp.price
        lastBar.h = Math.max(lastBar.h, yjp.price)
        lastBar.l = Math.min(lastBar.l, yjp.price)
        if (yjp.volume !== null && yjp.volume > barSumVol) {
          lastBar.v += yjp.volume - barSumVol
        }
        lastBar.tpOverride = (lastBar.h + lastBar.l + lastBar.c) / 3
        isRealtimePatched = yjp.delayMinutes === 0
      }
    }
  } else if (
    gfin?.latestPrice &&
    gfin?.latestTs &&
    finalBars.length > 0 &&
    gfin.latestTs > finalBars[finalBars.length - 1].ts + 30
  ) {
    // Fallback patch when Yahoo Japan wasn't available but Google Finance ds:2 has newer closing price
    const lastBar = finalBars[finalBars.length - 1]
    finalBars.push({
      ts: gfin.latestTs,
      o: lastBar.c,
      h: Math.max(lastBar.c, gfin.latestPrice),
      l: Math.min(lastBar.c, gfin.latestPrice),
      c: gfin.latestPrice,
      v: 0,
      tpOverride: gfin.latestPrice,
    })
  }

  const totalFinalVol = finalBars.reduce((acc, b) => acc + b.v, 0)
  const previousClose =
    yjp?.previousClose ?? gfin?.previousClose ?? prevDayClose ?? null
  const lastPoint = finalBars[finalBars.length - 1]

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        chart: {
          result: [
            {
              meta: {
                symbol: yahooSymbol,
                shortName: yjp?.name || gfin?.name || yahooSymbol,
                chartPreviousClose: previousClose,
                previousClose,
                regularMarketPrice: yjp?.price ?? lastPoint?.c ?? null,
                regularMarketVolume: yjp?.volume ?? totalFinalVol,
                officialVwap: yjp?.officialVwap ?? null,
                delayMinutes: yjp?.delayMinutes ?? (sourceLabel === 'tv' ? 20 : 15),
                ptsPrice: yjp?.ptsPrice ?? null,
                ptsPriceChange: yjp?.ptsPriceChange ?? null,
                ptsPriceChangeRate: yjp?.ptsPriceChangeRate ?? null,
                ptsUpdateTime: yjp?.ptsUpdateTime ?? null,
                japanUpdateTime: yjp?.japanUpdateTime ?? null,
                sessionDate: effectiveSessionDate,
                isRealtimePatched,
                isEarlySession,
                lastDelayedBarTimestamp,
                source: sourceLabel,
              },
              timestamp: finalBars.map((b) => b.ts),
              indicators: {
                quote: [
                  {
                    open: finalBars.map((b) => b.o),
                    high: finalBars.map((b) => b.h),
                    low: finalBars.map((b) => b.l),
                    close: finalBars.map((b) => b.c),
                    volume: finalBars.map((b) => b.v),
                    typicalPrice: finalBars.map((b) => b.tpOverride),
                  },
                ],
              },
            },
          ],
        },
      },
    },
  }
}

export default async function handler(req, res) {
  const { symbol = '7011.T', interval = '5m', range = '1d' } = req.query || {}

  try {
    const result = await buildRealtimeChartResponse({ symbol, interval, range })
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    return res.status(result.status).json(result.body)
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
