import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  MoveHorizontal,
  RefreshCw,
  Search,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useStockStore } from '../store/useStockStore'
import { formatNumber } from '../utils/format'

export interface VwapDataPoint {
  time: string
  timestamp: number
  price: number
  vwap: number
  vwapRounded: number
  volume: number
  cumVolume: number
  isInflection?: boolean
  signalLabel?: string
  signalType?: 'entry_buy' | 'entry_sell' | 'take_profit'
  vwapDeviationRate: number
  // VWAP ±1σ / ±2σ Bands (Volume-weighted around cumulative VWAP)
  vwapSigma: number
  upperBand1Sigma: number
  lowerBand1Sigma: number
  upperBand2Sigma: number
  lowerBand2Sigma: number
  bandRange2Sigma: [number, number]
  bandRange1Sigma: [number, number]
  // Standard Bollinger Bands (SMA ± 2σ)
  bbMiddle: number
  bbUpper2: number
  bbLower2: number
  bbSigma: number
  bbRange2: [number, number]
}

interface PresetTicker {
  code: string
  name: string
  basePrice: number
}

const POPULAR_DAYTRADE_TICKERS: PresetTicker[] = [
  { code: '7011', name: '三菱重工', basePrice: 2215 },
  { code: '6920', name: 'レーザーテック', basePrice: 15420 },
  { code: '5803', name: 'フジクラ', basePrice: 5680 },
  { code: '6146', name: 'ディスコ', basePrice: 38500 },
  { code: '8306', name: '三菱UFJ', basePrice: 1850 },
  { code: '7012', name: '川崎重工', basePrice: 6420 },
  { code: '9984', name: 'ソフトバンクG', basePrice: 9150 },
  { code: '9432', name: 'NTT', basePrice: 155 },
]

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val))

// Deterministic pseudo-random generator seeded by stock code so the chart NEVER jumps randomly
function seededNoise(seed: number, step: number): number {
  const x = Math.sin(seed * 9301 + step * 49297 + 233280) * 10000
  return x - Math.floor(x)
}

interface RawPoint {
  time: string
  timestamp: number
  price: number
  typicalPrice: number
  volume: number
}

// Compute cumulative VWAP + VWAP ±1σ/±2σ Bands + SMA Bollinger Bands + Auto Signal Detection
function enrichWithVwapAndBollinger(
  rawPoints: RawPoint[],
  bbPeriod = 8
): VwapDataPoint[] {
  let cumPV = 0
  let cumVol = 0
  const avgVol =
    rawPoints.reduce((acc, p) => acc + (p.volume || 1000), 0) /
    Math.max(1, rawPoints.length)

  const result: VwapDataPoint[] = []

  for (let i = 0; i < rawPoints.length; i++) {
    const pt = rawPoints[i]
    const v = Math.max(100, pt.volume || 1000)

    cumPV += pt.typicalPrice * v
    cumVol += v

    const vwapRaw = cumVol > 0 ? cumPV / cumVol : pt.price
    const vwap = Math.round(vwapRaw * 10) / 10
    const vwapRounded = Math.round(vwapRaw)

    // 1. Volume-weighted standard deviation around VWAP
    let weightedSqSum = 0
    for (let j = 0; j <= i; j++) {
      const w = Math.max(100, rawPoints[j].volume || 1000)
      const diff = rawPoints[j].price - vwapRaw
      weightedSqSum += w * diff * diff
    }
    const vwapVariance = cumVol > 0 ? weightedSqSum / cumVol : 0
    const vwapSigmaRaw = Math.max(
      pt.price * 0.0025,
      Math.sqrt(vwapVariance)
    )
    const vwapSigma = Math.round(vwapSigmaRaw * 10) / 10
    const upperBand1Sigma = Math.round(vwapRaw + vwapSigmaRaw)
    const lowerBand1Sigma = Math.round(vwapRaw - vwapSigmaRaw)
    const upperBand2Sigma = Math.round(vwapRaw + 2 * vwapSigmaRaw)
    const lowerBand2Sigma = Math.round(vwapRaw - 2 * vwapSigmaRaw)

    // 2. Standard Bollinger Bands (SMA ± 2σ)
    const startIdx = Math.max(0, i - bbPeriod + 1)
    const windowSlice = rawPoints.slice(startIdx, i + 1)
    const mean =
      windowSlice.reduce((acc, cur) => acc + cur.price, 0) /
      windowSlice.length
    const variance =
      windowSlice.reduce((acc, cur) => {
        const d = cur.price - mean
        return acc + d * d
      }, 0) / windowSlice.length
    const bbSigmaRaw = Math.max(pt.price * 0.0025, Math.sqrt(variance))
    const bbSigma = Math.round(bbSigmaRaw * 10) / 10
    const bbMiddle = Math.round(mean)
    const bbUpper2 = Math.round(mean + 2 * bbSigmaRaw)
    const bbLower2 = Math.round(mean - 2 * bbSigmaRaw)

    const vwapDeviationRate = Number(
      (((pt.price - vwapRaw) / vwapRaw) * 100).toFixed(2)
    )

    const isInflection = i === 0 || v >= avgVol * 1.25

    result.push({
      time: pt.time,
      timestamp: pt.timestamp,
      price: Math.round(pt.price * 10) / 10,
      vwap,
      vwapRounded,
      volume: Math.round(v),
      cumVolume: cumVol,
      isInflection,
      vwapDeviationRate,
      vwapSigma,
      upperBand1Sigma,
      lowerBand1Sigma,
      upperBand2Sigma,
      lowerBand2Sigma,
      bandRange2Sigma: [lowerBand2Sigma, upperBand2Sigma],
      bandRange1Sigma: [lowerBand1Sigma, upperBand1Sigma],
      bbMiddle,
      bbUpper2,
      bbLower2,
      bbSigma,
      bbRange2: [bbLower2, bbUpper2],
    })
  }

  // Automatically annotate 2 key intraday points (1. VWAP bounce/cross entry, 2. ±2σ target)
  // so the chart looks and reads just like the Chart Learning simulator!
  if (result.length >= 6) {
    let bestEntryIdx = -1
    let minAbsDiff = Infinity
    const searchStart = Math.max(2, Math.floor(result.length * 0.2))
    const searchEnd = Math.floor(result.length * 0.72)

    for (let i = searchStart; i <= searchEnd; i++) {
      const cur = result[i]
      const next = result[i + 1]
      const prev = result[i - 1]
      if (!next || !prev) continue
      const dist = Math.abs(cur.price - cur.vwap)
      // Look for pullback bounce near VWAP or upward crossover
      if (next.price > cur.price && dist < minAbsDiff) {
        minAbsDiff = dist
        bestEntryIdx = i
      }
    }

    if (bestEntryIdx !== -1) {
      const pt = result[bestEntryIdx]
      pt.isInflection = true
      pt.signalType = pt.price >= pt.vwap ? 'entry_buy' : 'entry_sell'
      pt.signalLabel =
        pt.price >= pt.vwap ? 'VWAP押し目反発' : 'VWAPクロス注目'
    }

    // Find peak deviation point in the latter half for ±2σ target marker
    let bestTargetIdx = -1
    let maxDev = -Infinity
    const targetStart = Math.max(
      bestEntryIdx + 2,
      Math.floor(result.length * 0.6)
    )
    for (let i = targetStart; i < result.length; i++) {
      const dev = Math.abs(result[i].price - result[i].vwap)
      if (dev > maxDev) {
        maxDev = dev
        bestTargetIdx = i
      }
    }

    if (bestTargetIdx !== -1 && bestTargetIdx !== bestEntryIdx) {
      const pt = result[bestTargetIdx]
      pt.isInflection = true
      pt.signalType = 'take_profit'
      pt.signalLabel =
        pt.price >= pt.vwap ? '+2σ利確目安' : '-2σ反発目安'
    }
  }

  return result
}

// Generate full Tokyo Stock Exchange trading session (09:00〜15:30) matching the Chart Learning style
function generateSimulatedSession(
  basePrice: number,
  codeSeedStr = '7011',
  intervalType: '15m' | '5m' | '1m' = '15m'
): VwapDataPoint[] {
  const rawPoints: RawPoint[] = []
  let currentPrice = basePrice

  const numericSeed =
    codeSeedStr
      .split('')
      .reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 1), 0) || 7011

  // Exact 18 intraday time points for 15m mode (matching VwapBandSimulator!) or 5m slots
  const timeSlots: string[] =
    intervalType === '15m'
      ? [
          '09:00',
          '09:15',
          '09:30',
          '09:45',
          '10:00',
          '10:15',
          '10:30',
          '10:45',
          '11:00',
          '11:30',
          '12:30',
          '13:00',
          '13:15',
          '13:45',
          '14:15',
          '14:45',
          '15:00',
          '15:30',
        ]
      : (() => {
          const slots: string[] = []
          const step = intervalType === '1m' ? 2 : 5
          for (let m = 9 * 60; m <= 11 * 60 + 30; m += step) {
            slots.push(
              `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(
                m % 60
              ).padStart(2, '0')}`
            )
          }
          for (let m = 12 * 60 + 30; m <= 15 * 60 + 30; m += step) {
            slots.push(
              `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(
                m % 60
              ).padStart(2, '0')}`
            )
          }
          return slots
        })()

  // Realistic intraday trend curve (opening surge -> mid-morning pullback to VWAP -> afternoon breakout toward +2σ)
  const patternMultipliers = [
    0.0, 0.011, 0.021, 0.024, 0.016, 0.012, 0.022, 0.029, 0.033, 0.036,
    0.03, 0.025, 0.022, 0.032, 0.039, 0.045, 0.049, 0.047,
  ]
  const direction = numericSeed % 3 === 0 ? -1 : 1

  for (let i = 0; i < timeSlots.length; i++) {
    const timeStr = timeSlots[i]
    const progress = i / Math.max(1, timeSlots.length - 1)
    const patIdx = Math.min(
      patternMultipliers.length - 1,
      Math.floor(progress * patternMultipliers.length)
    )
    const trendOffset =
      basePrice * patternMultipliers[patIdx] * direction
    const microWave =
      (seededNoise(numericSeed, i) - 0.48) * (basePrice * 0.004)

    currentPrice = Math.max(
      10,
      Math.round(basePrice + trendOffset + microWave)
    )

    const isKeyBar =
      i === 0 ||
      i === 5 ||
      i === 12 ||
      i === timeSlots.length - 2 ||
      i === timeSlots.length - 1
    const vol =
      Math.round(
        (600 + seededNoise(numericSeed + 7, i) * 700) *
          (isKeyBar ? 1.75 : 1.0)
      ) * 100

    rawPoints.push({
      time: timeStr,
      timestamp: Date.now() - (timeSlots.length - i) * 300000,
      price: currentPrice,
      typicalPrice: currentPrice,
      volume: vol,
    })
  }

  return enrichWithVwapAndBollinger(rawPoints, 8)
}

export const VwapChartCard: React.FC = () => {
  const { oco, updateOco, savedStocks, showToast } = useStockStore()

  const [selectedCode, setSelectedCode] = useState('7011')
  const [selectedName, setSelectedName] = useState('三菱重工')
  const [codeInput, setCodeInput] = useState('7011')
  const [interval, setIntervalType] = useState<'15m' | '5m' | '1m'>('15m')
  const [isLoading, setIsLoading] = useState(false)
  const [dataSourceLabel, setDataSourceLabel] = useState<string>('自動更新OFF')
  const [prevClose, setPrevClose] = useState<number | null>(null)
  const [chartData, setChartData] = useState<VwapDataPoint[]>([])

  // Same toggle options as VwapBandSimulator ("VWAP±2σ チャート学習")
  const [showBollingerOverlay, setShowBollingerOverlay] =
    useState<boolean>(true)
  const [show1Sigma, setShow1Sigma] = useState<boolean>(true)

  // Horizontal Click-and-Drag Pan & Zoom state
  const [zoom, setZoom] = useState<number>(1.0)
  const [panX, setPanX] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [viewportWidth, setViewportWidth] = useState<number>(340)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const dragStartRef = useRef<{ clientX: number; startPanX: number } | null>(
    null
  )

  // Measure viewport width for responsive horizontal panning bounds
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setViewportWidth(el.clientWidth)
      }
    }
    updateWidth()
    const ro = new ResizeObserver(updateWidth)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const canvasWidth = Math.max(viewportWidth, Math.round(viewportWidth * zoom))
  const overscrollMargin = Math.round(viewportWidth * 0.45)
  const minPanX = -(canvasWidth - viewportWidth) - overscrollMargin
  const maxPanX = overscrollMargin

  const handleChangeZoom = (nextZoom: number) => {
    const clampedZoom = clamp(Number(nextZoom.toFixed(2)), 1.0, 3.5)
    const prevCanvasW = Math.max(viewportWidth, viewportWidth * zoom)
    const nextCanvasW = Math.max(viewportWidth, viewportWidth * clampedZoom)
    const centerRatio = (viewportWidth / 2 - panX) / prevCanvasW
    const nextPan = Math.round(viewportWidth / 2 - centerRatio * nextCanvasW)
    const nextMinPan = -(nextCanvasW - viewportWidth) - overscrollMargin
    setZoom(clampedZoom)
    setPanX(clamp(nextPan, nextMinPan, maxPanX))
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartRef.current = {
      clientX: e.clientX,
      startPanX: panX,
    }
    setIsDragging(true)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return
    const deltaX = e.clientX - dragStartRef.current.clientX
    const nextPan = clamp(
      dragStartRef.current.startPanX + deltaX,
      minPanX,
      maxPanX
    )
    setPanX(nextPan)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // Ignore
      }
    }
    dragStartRef.current = null
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 1) {
      e.preventDefault()
      setPanX((prev) => clamp(prev - e.deltaX, minPanX, maxPanX))
    }
  }

  // Merge user's saved stocks (that have a ticker code) with popular daytrade tickers
  const tickerList = useMemo(() => {
    const custom: PresetTicker[] = savedStocks
      .filter((s) => s.code && s.code.trim() !== '')
      .map((s) => ({
        code: s.code.trim(),
        name: s.name.replace(/（サンプル）$/, ''),
        basePrice: s.currentPrice || 1500,
      }))

    const merged = [...custom]
    for (const pop of POPULAR_DAYTRADE_TICKERS) {
      if (!merged.some((m) => m.code === pop.code)) {
        merged.push(pop)
      }
    }
    return merged
  }, [savedStocks])

  const tickerListRef = useRef(tickerList)
  tickerListRef.current = tickerList

  // Parse Yahoo Finance v8 chart response and compute cumulative Intraday VWAP + Bollinger Bands
  const parseYahooChartAndComputeVwap = (rawChartResult: unknown): {
    points: VwapDataPoint[]
    previousClose: number | null
    shortName?: string
  } | null => {
    try {
      const root = rawChartResult as {
        chart?: {
          result?: Array<{
            meta?: {
              chartPreviousClose?: number
              previousClose?: number
              shortName?: string
              symbol?: string
            }
            timestamp?: number[]
            indicators?: {
              quote?: Array<{
                open?: Array<number | null>
                high?: Array<number | null>
                low?: Array<number | null>
                close?: Array<number | null>
                volume?: Array<number | null>
              }>
            }
          }>
        }
      }

      const res = root?.chart?.result?.[0]
      if (!res || !Array.isArray(res.timestamp) || !res.indicators?.quote?.[0]) {
        return null
      }

      const timestamps = res.timestamp
      const quote = res.indicators.quote[0]
      const highs = quote.high || []
      const lows = quote.low || []
      const closes = quote.close || []
      const volumes = quote.volume || []

      const rawPoints: RawPoint[] = []

      for (let i = 0; i < timestamps.length; i++) {
        const c = closes[i]
        if (c === null || c === undefined || !Number.isFinite(c)) continue

        const h = highs[i] ?? c
        const l = lows[i] ?? c
        const v = Math.max(0, volumes[i] ?? 0)
        const typicalPrice = (h + l + c) / 3

        const date = new Date(timestamps[i] * 1000)
        const jstStr = date.toLocaleTimeString('ja-JP', {
          timeZone: 'Asia/Tokyo',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })

        rawPoints.push({
          time: jstStr,
          timestamp: timestamps[i] * 1000,
          price: c,
          typicalPrice,
          volume: v,
        })
      }

      if (rawPoints.length === 0) return null

      return {
        points: enrichWithVwapAndBollinger(rawPoints, 8),
        previousClose:
          res.meta?.chartPreviousClose ?? res.meta?.previousClose ?? null,
        shortName: res.meta?.shortName,
      }
    } catch {
      return null
    }
  }

  // Only fetches when explicitly requested (ticker change, interval change, or manual refresh button)
  const fetchIntradayData = useCallback(
    async (codeToFetch: string, intervalToFetch: '15m' | '5m' | '1m') => {
      setIsLoading(true)
      const cleanCode = codeToFetch.trim().toUpperCase()
      const yahooSym =
        /^\d{4}$/.test(cleanCode) || /^\d{3}[A-Z]$/.test(cleanCode)
          ? `${cleanCode}.T`
          : cleanCode

      try {
        // 1. Try Vercel Serverless Function `/api/chart`
        try {
          const apiRes = await fetch(
            `/api/chart?symbol=${encodeURIComponent(
              yahooSym
            )}&interval=${intervalToFetch}&range=1d`
          )
          const contentType = apiRes.headers.get('content-type') || ''
          if (apiRes.ok && contentType.includes('application/json')) {
            const json = await apiRes.json()
            const parsed = parseYahooChartAndComputeVwap(json.data)
            if (parsed && parsed.points.length > 0) {
              setChartData(parsed.points)
              setPrevClose(parsed.previousClose)
              setPanX(0)
              const lastTime =
                parsed.points[parsed.points.length - 1]?.time || ''
              setDataSourceLabel(
                `東証データ (09:00〜${lastTime}・自動更新OFF)`
              )
              setIsLoading(false)
              return
            }
          }
        } catch {
          // Proceed to Step 2
        }

        // 2. Try local Vite dev server proxy `/yahoo-api`
        try {
          const viteProxyRes = await fetch(
            `/yahoo-api/v8/finance/chart/${encodeURIComponent(
              yahooSym
            )}?interval=${intervalToFetch}&range=1d&includePrePost=false`
          )
          const contentType = viteProxyRes.headers.get('content-type') || ''
          if (viteProxyRes.ok && contentType.includes('application/json')) {
            const rawData = await viteProxyRes.json()
            const parsed = parseYahooChartAndComputeVwap(rawData)
            if (parsed && parsed.points.length > 0) {
              setChartData(parsed.points)
              setPrevClose(parsed.previousClose)
              setPanX(0)
              const lastTime =
                parsed.points[parsed.points.length - 1]?.time || ''
              setDataSourceLabel(
                `東証データ (09:00〜${lastTime}・自動更新OFF)`
              )
              setIsLoading(false)
              return
            }
          }
        } catch {
          // Proceed to fallback
        }

        throw new Error('Fallback to simulated intraday data')
      } catch {
        const matched = tickerListRef.current.find((t) => t.code === cleanCode)
        const base = matched?.basePrice || 2000
        const sim = generateSimulatedSession(base, cleanCode, intervalToFetch)
        setChartData(sim)
        setPrevClose(base)
        setPanX(0)
        setDataSourceLabel('09:00〜15:30 全日波形（自動更新OFF）')
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    void fetchIntradayData(selectedCode, interval)
  }, [selectedCode, interval, fetchIntradayData])

  const latestPoint =
    chartData.length > 0 ? chartData[chartData.length - 1] : null
  const currentPrice = latestPoint ? latestPoint.price : 0
  const currentVwap = latestPoint ? latestPoint.vwap : 0
  const vwapDiff = currentPrice - currentVwap
  const vwapDiffPercent =
    currentVwap > 0 ? (vwapDiff / currentVwap) * 100 : 0
  const isAboveVwap = vwapDiff >= 0

  const activeUpper2 = latestPoint ? latestPoint.upperBand2Sigma : 0
  const activeLower2 = latestPoint ? latestPoint.lowerBand2Sigma : 0
  const activeSigmaScore = useMemo(() => {
    if (!latestPoint || latestPoint.vwapSigma <= 0) return 0
    return (latestPoint.price - latestPoint.vwap) / latestPoint.vwapSigma
  }, [latestPoint])

  // Compute 5 evenly spaced Y-axis ticks with generous top headroom so labels/lines never clip
  const { yDomain, yTicks } = useMemo(() => {
    if (chartData.length === 0) {
      return {
        yDomain: [1900, 2100] as [number, number],
        yTicks: [2100, 2050, 2000, 1950, 1900],
      }
    }
    let minVal = Infinity
    let maxVal = -Infinity
    for (const pt of chartData) {
      minVal = Math.min(minVal, pt.price, pt.lowerBand2Sigma)
      maxVal = Math.max(maxVal, pt.price, pt.upperBand2Sigma)
      if (showBollingerOverlay) {
        minVal = Math.min(minVal, pt.bbLower2)
        maxVal = Math.max(maxVal, pt.bbUpper2)
      }
    }
    if (prevClose && Number.isFinite(prevClose)) {
      minVal = Math.min(minVal, prevClose)
      maxVal = Math.max(maxVal, prevClose)
    }
    const range = Math.max(10, maxVal - minVal)
    const bottomPad = Math.max(4, Math.round(range * 0.12))
    const topPad = Math.max(8, Math.round(range * 0.2))
    const rawMin = Math.floor(minVal - bottomPad)
    const rawMax = Math.ceil(maxVal + topPad)
    const step = Math.max(1, Math.ceil((rawMax - rawMin) / 4))
    const finalMax = rawMin + step * 4
    return {
      yDomain: [rawMin, finalMax] as [number, number],
      yTicks: [
        finalMax,
        rawMin + step * 3,
        rawMin + step * 2,
        rawMin + step,
        rawMin,
      ],
    }
  }, [chartData, prevClose, showBollingerOverlay])

  const maxVolume = useMemo(() => {
    let m = 1000
    for (const d of chartData) {
      if (d.volume > m) m = d.volume
    }
    return Math.ceil(m / 500) * 500
  }, [chartData])

  const signalPoints = useMemo(
    () => chartData.filter((d) => Boolean(d.signalLabel)),
    [chartData]
  )

  const totalPanRange = Math.max(1, maxPanX - minPanX)
  const thumbWidthPct = clamp((viewportWidth / canvasWidth) * 100, 18, 90)
  const thumbLeftPct = clamp(
    ((maxPanX - panX) / totalPanRange) * (100 - thumbWidthPct),
    0,
    100 - thumbWidthPct
  )

  const handleSelectTicker = (ticker: PresetTicker) => {
    setSelectedCode(ticker.code)
    setSelectedName(ticker.name)
    setCodeInput(ticker.code)
  }

  const handleCustomCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = codeInput.trim().toUpperCase()
    if (!clean) return
    const matched = tickerList.find((t) => t.code === clean)
    setSelectedCode(clean)
    setSelectedName(matched ? matched.name : `銘柄 ${clean}`)
  }

  const applyPriceToOco = (targetPrice: number, sourceName: string) => {
    if (targetPrice <= 0) return
    const rounded = Math.round(targetPrice)
    const budget = oco.budgetYen || 400000
    const nextAutoShares = Math.max(
      100,
      Math.floor(budget / rounded / 100) * 100
    )
    updateOco({
      priceInput: String(rounded),
      sharesInput: oco.manualShares ? oco.sharesInput : String(nextAutoShares),
      memoLabel: `${selectedCode} ${selectedName}`,
    })
    showToast(
      `${selectedName}の${sourceName}（${rounded.toLocaleString()}円）をOCO電卓にセットしました`
    )
  }

  return (
    <div className="bg-[#1e2433] text-white rounded-3xl p-4 shadow-xl border border-slate-700/80 space-y-3.5">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm sm:text-base font-extrabold text-white">
              銘柄別 VWAP±2σ ＆ ボリンジャーチャート
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            {dataSourceLabel}
          </span>
        </div>

        {/* 15m / 5m / 1m + Manual Refresh */}
        <div className="flex items-center gap-1.5">
          <div className="bg-[#0f172a] p-0.5 rounded-lg border border-slate-700 flex text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setIntervalType('15m')}
              className={`px-2 py-1 rounded-md transition ${
                interval === '15m'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              15分足
            </button>
            <button
              type="button"
              onClick={() => setIntervalType('5m')}
              className={`px-2 py-1 rounded-md transition ${
                interval === '5m'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              5分足
            </button>
            <button
              type="button"
              onClick={() => setIntervalType('1m')}
              className={`px-2 py-1 rounded-md transition ${
                interval === '1m'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1分足
            </button>
          </div>

          <button
            type="button"
            onClick={() => void fetchIntradayData(selectedCode, interval)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-[11px] font-bold flex items-center gap-1 active:scale-95 transition"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
            />
            再取得
          </button>
        </div>
      </div>

      {/* Stock Picker Row */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {tickerList.map((ticker) => {
            const isSelected = selectedCode === ticker.code
            return (
              <button
                key={ticker.code}
                type="button"
                onClick={() => handleSelectTicker(ticker)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 border transition active:scale-95 ${
                  isSelected
                    ? 'bg-[#60a5fa] text-slate-950 border-[#60a5fa] shadow-xs font-extrabold'
                    : 'bg-[#0f172a] text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
              >
                <span className="opacity-75 mr-1 font-mono">{ticker.code}</span>
                {ticker.name}
              </button>
            )
          })}
        </div>

        {/* Custom 4-digit Stock Code Search Bar */}
        <form onSubmit={handleCustomCodeSubmit} className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-[#0f172a] border border-slate-700 rounded-xl px-3 py-1.5 focus-within:border-[#60a5fa]">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              value={codeInput}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="証券コード4桁を入力 (例: 7011, 7203, 9101)"
              className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none font-bold"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-extrabold text-white shrink-0 active:scale-95 transition"
          >
            銘柄切替
          </button>
        </form>
      </div>

      {/* Current Price vs VWAP & ±2σ Summary Banner */}
      <div className="grid grid-cols-3 gap-2 bg-[#0f172a] rounded-2xl p-3 border border-slate-700/90 items-center">
        <div>
          <div className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#38bdf8] inline-block" />
            現在株価 ({selectedCode})
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#38bdf8] tracking-tight mt-0.5">
            {currentPrice > 0 ? `${formatNumber(currentPrice, 1)}円` : '---'}
          </div>
          <div className="text-[10px] font-bold text-slate-400 mt-0.5">
            {isAboveVwap ? (
              <span className="text-emerald-400 inline-flex items-center">
                <ArrowUpRight className="w-3 h-3" />
                VWAP +{vwapDiff.toFixed(1)}円
              </span>
            ) : (
              <span className="text-rose-400 inline-flex items-center">
                <ArrowDownRight className="w-3 h-3" />
                VWAP {vwapDiff.toFixed(1)}円
              </span>
            )}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-amber-300 font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b] inline-block" />
            累計VWAP
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#f59e0b] tracking-tight mt-0.5">
            {currentVwap > 0 ? `${formatNumber(currentVwap, 1)}円` : '---'}
          </div>
          <div className="text-[10px] font-bold text-slate-400 mt-0.5">
            乖離率: {vwapDiffPercent >= 0 ? '+' : ''}
            {vwapDiffPercent.toFixed(2)}%
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] text-purple-300 font-bold">
            バンド位置 (σ)
          </div>
          <div className="text-sm sm:text-base font-extrabold text-white font-mono mt-0.5">
            {activeSigmaScore >= 0 ? '+' : ''}
            {activeSigmaScore.toFixed(2)}σ
          </div>
          <div className="text-[10px] font-mono text-slate-300 mt-0.5">
            <span className="text-rose-300">+2σ:{Math.round(activeUpper2)}</span>{' '}
            /{' '}
            <span className="text-emerald-300">
              -2σ:{Math.round(activeLower2)}
            </span>
          </div>
        </div>
      </div>

      {/* Main + Volume 2-Tier Synchronized Chart (Exact same visual structure as VWAP±2σ チャート学習!) */}
      <div className="bg-[#0f172a] rounded-2xl p-3 border border-slate-700/90 space-y-2.5">
        {/* Chart Top Controls: Title + Zoom + Bollinger Toggle + ±1σ Toggle */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-amber-300">
              {selectedCode} {selectedName}（日中VWAP ±2σ ＆ ボリンジャー・出来高連動）
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/15 text-sky-300 border border-sky-500/30">
              <MoveHorizontal className="w-3 h-3" />
              ドラッグで左右スクロール可
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Zoom buttons */}
            <div className="inline-flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-700 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => handleChangeZoom(zoom - 0.3)}
                className="p-1 text-slate-300 hover:text-white active:scale-95"
                title="縮小"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1.0)
                  setPanX(0)
                }}
                className={`px-1.5 py-0.5 rounded ${
                  zoom === 1.0
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                全体
              </button>
              <button
                type="button"
                onClick={() => handleChangeZoom(1.6)}
                className={`px-1.5 py-0.5 rounded ${
                  Math.abs(zoom - 1.6) < 0.15
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                1.6x
              </button>
              <button
                type="button"
                onClick={() => handleChangeZoom(2.4)}
                className={`px-1.5 py-0.5 rounded ${
                  zoom >= 2.2
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                2.4x
              </button>
              <button
                type="button"
                onClick={() => handleChangeZoom(zoom + 0.3)}
                className="p-1 text-slate-300 hover:text-white active:scale-95"
                title="拡大"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowBollingerOverlay(!showBollingerOverlay)}
              className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border transition ${
                showBollingerOverlay
                  ? 'bg-purple-600/30 text-purple-200 border-purple-400/60'
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}
            >
              ボリンジャー(BB) {showBollingerOverlay ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() => setShow1Sigma(!show1Sigma)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                show1Sigma
                  ? 'bg-slate-800 text-slate-200 border-slate-600'
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}
            >
              ±1σ {show1Sigma ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Legend (Matches VwapBandSimulator!) */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold">
          <span className="flex items-center gap-1 text-[#38bdf8]">
            <span className="w-3 h-0.5 bg-[#38bdf8] inline-block" />
            株価
          </span>
          <span className="flex items-center gap-1 text-[#f59e0b]">
            <span className="w-3.5 h-1 bg-[#f59e0b] inline-block rounded-full" />
            VWAP (機関基準)
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <span className="w-3 h-0.5 border-b-2 border-dashed border-rose-400 inline-block" />
            VWAP+2σ
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-3 h-0.5 border-b-2 border-dashed border-emerald-400 inline-block" />
            VWAP-2σ
          </span>
          {showBollingerOverlay && (
            <span className="flex items-center gap-1 text-purple-300">
              <span className="w-3 h-1.5 bg-purple-500/40 border border-purple-400 inline-block rounded-xs" />
              ボリンジャーバンド(SMA±2σ)
            </span>
          )}
        </div>

        {/* Interactive Click-and-Drag Chart Box (Pinned Y-Axis + Upper Main Chart + Lower Volume BarChart) */}
        <div className="relative rounded-xl border border-slate-800 bg-[#0b1120] overflow-hidden">
          <div className="flex">
            {/* Pinned Left Y-Axis Column (Price + Volume) */}
            <div className="w-12 shrink-0 border-r border-slate-800/90 bg-[#0f172a]/95 z-10 select-none flex flex-col">
              <div className="h-[268px] pt-[28px] pb-[22px] px-1.5 flex flex-col justify-between items-end text-[10px] font-mono text-slate-400">
                {yTicks.map((t) => (
                  <span key={t} className="leading-none">
                    {t}
                  </span>
                ))}
              </div>
              <div className="h-24 border-t border-slate-800/80 pt-1.5 pb-4 px-1.5 flex flex-col justify-between items-end text-[9px] font-mono text-slate-500">
                <span>{maxVolume.toLocaleString()}</span>
                <span>出来高</span>
                <span>0</span>
              </div>
            </div>

            {/* Horizontally Draggable Plot Area */}
            <div
              ref={viewportRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              className={`flex-1 overflow-hidden select-none touch-pan-y ${
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              <div
                style={{
                  width: `${canvasWidth}px`,
                  transform: `translate3d(${panX}px, 0, 0)`,
                }}
                className="will-change-transform"
              >
                {/* Upper Main Chart: Price + VWAP + ±1σ / ±2σ Bands + Bollinger Ribbon */}
                <div className="h-[268px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 28, right: 32, left: 16, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1e293b"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="time"
                        height={22}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={16}
                      />
                      <YAxis domain={yDomain} ticks={yTicks} hide />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (
                            isDragging ||
                            !active ||
                            !payload ||
                            !payload.length
                          ) {
                            return null
                          }
                          const pt = payload[0].payload as VwapDataPoint
                          return (
                            <div className="bg-slate-900/95 border border-slate-600 rounded-xl p-2.5 text-xs shadow-xl space-y-1 min-w-[215px]">
                              <div className="flex items-center justify-between border-b border-slate-700 pb-1">
                                <span className="font-extrabold text-white">
                                  ⏰ {pt.time}
                                </span>
                                {pt.signalLabel && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold text-[10px]">
                                    {pt.signalLabel}
                                  </span>
                                )}
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#38bdf8] font-bold">
                                  現在値 (Price)：
                                </span>
                                <span className="font-mono font-extrabold text-white">
                                  {pt.price.toLocaleString()}円
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#f59e0b] font-bold">
                                  累計VWAP：
                                </span>
                                <span className="font-mono font-extrabold text-[#f59e0b]">
                                  {pt.vwap.toLocaleString()}円
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">
                                  VWAP乖離率：
                                </span>
                                <span
                                  className={`font-mono font-bold ${
                                    pt.vwapDeviationRate >= 0
                                      ? 'text-emerald-400'
                                      : 'text-rose-400'
                                  }`}
                                >
                                  {pt.vwapDeviationRate >= 0 ? '+' : ''}
                                  {pt.vwapDeviationRate.toFixed(2)}%
                                </span>
                              </div>
                              <div className="border-t border-slate-800 pt-1 mt-1 space-y-0.5 text-[11px]">
                                <div className="flex justify-between text-rose-300">
                                  <span>VWAP +2σ：</span>
                                  <span className="font-mono font-bold">
                                    {pt.upperBand2Sigma.toLocaleString()}円
                                  </span>
                                </div>
                                <div className="flex justify-between text-emerald-300">
                                  <span>VWAP -2σ：</span>
                                  <span className="font-mono font-bold">
                                    {pt.lowerBand2Sigma.toLocaleString()}円
                                  </span>
                                </div>
                                {showBollingerOverlay && (
                                  <div className="flex justify-between text-purple-300">
                                    <span>ボリンジャー±2σ：</span>
                                    <span className="font-mono font-bold">
                                      {pt.bbLower2.toLocaleString()} 〜{' '}
                                      {pt.bbUpper2.toLocaleString()}円
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between text-amber-200/90 pt-0.5">
                                  <span>出来高：</span>
                                  <span className="font-mono font-bold">
                                    {pt.volume.toLocaleString()} 株
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        }}
                      />

                      {/* Shaded Ribbon Fill for VWAP ±2σ and ±1σ */}
                      <Area
                        type="monotone"
                        dataKey="bandRange2Sigma"
                        stroke="none"
                        fill="#38bdf8"
                        fillOpacity={0.06}
                        isAnimationActive={false}
                      />
                      {show1Sigma && (
                        <Area
                          type="monotone"
                          dataKey="bandRange1Sigma"
                          stroke="none"
                          fill="#38bdf8"
                          fillOpacity={0.09}
                          isAnimationActive={false}
                        />
                      )}

                      {/* Standard Bollinger Band Ribbon (SMA ± 2σ) */}
                      {showBollingerOverlay && (
                        <>
                          <Area
                            type="monotone"
                            dataKey="bbRange2"
                            stroke="none"
                            fill="#a855f7"
                            fillOpacity={0.12}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="bbUpper2"
                            stroke="#c084fc"
                            strokeWidth={1.3}
                            strokeDasharray="2 2"
                            dot={false}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="bbMiddle"
                            stroke="#a855f7"
                            strokeWidth={1.2}
                            dot={false}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="bbLower2"
                            stroke="#c084fc"
                            strokeWidth={1.3}
                            strokeDasharray="2 2"
                            dot={false}
                            isAnimationActive={false}
                          />
                        </>
                      )}

                      {/* Vertical reference lines on key signal points */}
                      {signalPoints.map((sp) => (
                        <ReferenceLine
                          key={sp.time}
                          x={sp.time}
                          stroke={
                            sp.signalType === 'entry_buy'
                              ? '#10b981'
                              : sp.signalType === 'entry_sell'
                              ? '#f43f5e'
                              : '#f59e0b'
                          }
                          strokeDasharray="3 3"
                          label={{
                            value: sp.signalLabel,
                            position: 'top',
                            dy: -4,
                            fill: '#fbbf24',
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                        />
                      ))}

                      {/* VWAP +2σ Band */}
                      <Line
                        type="monotone"
                        dataKey="upperBand2Sigma"
                        stroke="#fb7185"
                        strokeWidth={1.5}
                        strokeDasharray="5 4"
                        dot={false}
                        isAnimationActive={false}
                      />

                      {/* VWAP +1σ / -1σ Bands */}
                      {show1Sigma && (
                        <>
                          <Line
                            type="monotone"
                            dataKey="upperBand1Sigma"
                            stroke="#64748b"
                            strokeWidth={1}
                            strokeDasharray="3 3"
                            dot={false}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="lowerBand1Sigma"
                            stroke="#64748b"
                            strokeWidth={1}
                            strokeDasharray="3 3"
                            dot={false}
                            isAnimationActive={false}
                          />
                        </>
                      )}

                      {/* VWAP -2σ Band */}
                      <Line
                        type="monotone"
                        dataKey="lowerBand2Sigma"
                        stroke="#34d399"
                        strokeWidth={1.5}
                        strokeDasharray="5 4"
                        dot={false}
                        isAnimationActive={false}
                      />

                      {/* Cumulative VWAP Line (Gold/Amber) */}
                      <Line
                        type="monotone"
                        dataKey="vwap"
                        name="VWAP"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={false}
                        isAnimationActive={false}
                      />

                      {/* Intraday Price Line (Sky Blue with Signal Dots) */}
                      <Line
                        type="monotone"
                        dataKey="price"
                        name="株価"
                        stroke="#38bdf8"
                        strokeWidth={2.5}
                        dot={(props) => {
                          const { cx, cy, payload } = props as {
                            cx?: number
                            cy?: number
                            payload?: VwapDataPoint
                          }
                          if (
                            cx === undefined ||
                            cy === undefined ||
                            !payload
                          ) {
                            return <g key="empty" />
                          }
                          if (!payload.signalLabel) {
                            return (
                              <circle
                                key={payload.time}
                                cx={cx}
                                cy={cy}
                                r={interval === '15m' ? 3 : 2}
                                fill="#38bdf8"
                              />
                            )
                          }
                          const fill =
                            payload.signalType === 'entry_buy'
                              ? '#10b981'
                              : payload.signalType === 'entry_sell'
                              ? '#f43f5e'
                              : '#f59e0b'
                          return (
                            <circle
                              key={payload.time}
                              cx={cx}
                              cy={cy}
                              r={6}
                              fill={fill}
                              stroke="#ffffff"
                              strokeWidth={2}
                            />
                          )
                        }}
                        activeDot={{ r: 6, fill: '#38bdf8', stroke: '#fff' }}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Lower Synchronized Volume Bar Chart */}
                <div className="h-24 w-full border-t border-slate-800/80 pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 4, right: 32, left: 16, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1e293b"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="time"
                        height={18}
                        tick={{ fontSize: 9, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={16}
                      />
                      <YAxis domain={[0, maxVolume]} hide />
                      <Bar
                        dataKey="volume"
                        radius={[3, 3, 0, 0]}
                        isAnimationActive={false}
                      >
                        {chartData.map((entry) => (
                          <Cell
                            key={entry.time}
                            fill={entry.isInflection ? '#f59e0b' : '#475569'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Horizontal Scrollbar Position Track */}
          <div className="h-1.5 bg-slate-900 border-t border-slate-800/80 relative">
            <div
              className="h-full bg-sky-400/60 rounded-full transition-all duration-75"
              style={{
                width: `${thumbWidthPct}%`,
                marginLeft: `${thumbLeftPct}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* One-Tap Send to OCO Calculator Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => applyPriceToOco(currentPrice, '現在値')}
          className="py-2 px-2.5 rounded-xl bg-[#38bdf8]/15 hover:bg-[#38bdf8]/25 border border-[#38bdf8]/50 text-[#38bdf8] text-xs font-extrabold flex items-center justify-center gap-1 active:scale-95 transition"
        >
          <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
          現在値 ({Math.round(currentPrice).toLocaleString()}円)
        </button>

        <button
          type="button"
          onClick={() => applyPriceToOco(currentVwap, 'VWAP値')}
          className="py-2 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/50 text-amber-300 text-xs font-extrabold flex items-center justify-center gap-1 active:scale-95 transition"
        >
          <Activity className="w-3.5 h-3.5 shrink-0" />
          VWAP ({Math.round(currentVwap).toLocaleString()}円)
        </button>

        <button
          type="button"
          onClick={() => applyPriceToOco(activeLower2, '-2σ反発目安')}
          className="py-2 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/50 text-emerald-300 text-xs font-extrabold flex items-center justify-center gap-1 active:scale-95 transition"
        >
          -2σ ({Math.round(activeLower2).toLocaleString()}円) をOCOへ
        </button>

        <button
          type="button"
          onClick={() => applyPriceToOco(activeUpper2, '+2σ加熱目安')}
          className="py-2 px-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/50 text-rose-300 text-xs font-extrabold flex items-center justify-center gap-1 active:scale-95 transition"
        >
          +2σ ({Math.round(activeUpper2).toLocaleString()}円) をOCOへ
        </button>
      </div>
    </div>
  )
}
