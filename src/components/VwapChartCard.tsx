import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  CartesianGrid,
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
  Layers,
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
  volume: number
  cumVolume: number
  // Bollinger Bands (SMA-based, window up to 20)
  bbMiddle: number
  bbUpper1: number
  bbLower1: number
  bbUpper2: number
  bbLower2: number
  bbUpper3: number
  bbLower3: number
  bbSigma: number
  bbRange2: [number, number]
  bbRange1: [number, number]
  // VWAP Bollinger Bands (Volume-weighted around cumulative VWAP)
  vwapUpper1: number
  vwapLower1: number
  vwapUpper2: number
  vwapLower2: number
  vwapUpper3: number
  vwapLower3: number
  vwapSigma: number
  vwapRange2: [number, number]
  vwapRange1: [number, number]
}

export type BandMode = 'bollinger' | 'vwap_band' | 'off'

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

// Compute cumulative VWAP + SMA Bollinger Bands (±1σ, ±2σ, ±3σ) + VWAP Bands (±1σ, ±2σ, ±3σ)
function enrichWithVwapAndBollinger(
  rawPoints: RawPoint[],
  bbPeriod = 20
): VwapDataPoint[] {
  let cumPV = 0
  let cumVol = 0
  const result: VwapDataPoint[] = []

  for (let i = 0; i < rawPoints.length; i++) {
    const pt = rawPoints[i]
    const v = Math.max(0, pt.volume)

    if (v > 0) {
      cumPV += pt.typicalPrice * v
      cumVol += v
    } else if (cumVol === 0) {
      cumPV = pt.price
      cumVol = 1
    }

    const vwapRaw = cumVol > 0 ? cumPV / cumVol : pt.price
    const vwap = Math.round(vwapRaw * 10) / 10

    // 1. Volume-weighted standard deviation around VWAP
    let weightedSqSum = 0
    for (let j = 0; j <= i; j++) {
      const w = Math.max(1, rawPoints[j].volume)
      const diff = rawPoints[j].price - vwapRaw
      weightedSqSum += w * diff * diff
    }
    const vwapVariance = cumVol > 0 ? weightedSqSum / cumVol : 0
    // Ensure a small minimum visual sigma on index 0 so the band doesn't pinch to zero width at 09:00
    const vwapSigmaRaw = Math.max(
      pt.price * 0.0015,
      Math.sqrt(vwapVariance)
    )
    const vwapSigma = Math.round(vwapSigmaRaw * 10) / 10
    const vwapUpper1 = Math.round((vwapRaw + vwapSigmaRaw) * 10) / 10
    const vwapLower1 = Math.round((vwapRaw - vwapSigmaRaw) * 10) / 10
    const vwapUpper2 = Math.round((vwapRaw + 2 * vwapSigmaRaw) * 10) / 10
    const vwapLower2 = Math.round((vwapRaw - 2 * vwapSigmaRaw) * 10) / 10
    const vwapUpper3 = Math.round((vwapRaw + 3 * vwapSigmaRaw) * 10) / 10
    const vwapLower3 = Math.round((vwapRaw - 3 * vwapSigmaRaw) * 10) / 10

    // 2. Standard Bollinger Bands (SMA + standard deviation over up to `bbPeriod` bars)
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
    const bbSigmaRaw = Math.max(pt.price * 0.0015, Math.sqrt(variance))
    const bbSigma = Math.round(bbSigmaRaw * 10) / 10
    const bbMiddle = Math.round(mean * 10) / 10
    const bbUpper1 = Math.round((mean + bbSigmaRaw) * 10) / 10
    const bbLower1 = Math.round((mean - bbSigmaRaw) * 10) / 10
    const bbUpper2 = Math.round((mean + 2 * bbSigmaRaw) * 10) / 10
    const bbLower2 = Math.round((mean - 2 * bbSigmaRaw) * 10) / 10
    const bbUpper3 = Math.round((mean + 3 * bbSigmaRaw) * 10) / 10
    const bbLower3 = Math.round((mean - 3 * bbSigmaRaw) * 10) / 10

    result.push({
      time: pt.time,
      timestamp: pt.timestamp,
      price: Math.round(pt.price * 10) / 10,
      vwap,
      volume: v || 1000,
      cumVolume: cumVol,
      bbMiddle,
      bbUpper1,
      bbLower1,
      bbUpper2,
      bbLower2,
      bbUpper3,
      bbLower3,
      bbSigma,
      bbRange2: [bbLower2, bbUpper2],
      bbRange1: [bbLower1, bbUpper1],
      vwapUpper1,
      vwapLower1,
      vwapUpper2,
      vwapLower2,
      vwapUpper3,
      vwapLower3,
      vwapSigma,
      vwapRange2: [vwapLower2, vwapUpper2],
      vwapRange1: [vwapLower1, vwapUpper1],
    })
  }

  return result
}

// Generate realistic deterministic intraday points & cumulative VWAP + Bollinger Bands
function generateSimulatedSession(
  basePrice: number,
  codeSeedStr = '7011',
  pointsCount = 54
): VwapDataPoint[] {
  const rawPoints: RawPoint[] = []
  let currentPrice = basePrice

  const numericSeed =
    codeSeedStr
      .split('')
      .reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 1), 0) || 7011

  const startHour = 9
  const startMin = 0

  for (let i = 0; i < pointsCount; i++) {
    const totalMins = startMin + i * 5
    const h = startHour + Math.floor(totalMins / 60)
    const m = totalMins % 60
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

    const wave = Math.sin((i + (numericSeed % 5)) / 4.5) * (basePrice * 0.005)
    const n = (seededNoise(numericSeed, i) - 0.47) * (basePrice * 0.004)
    currentPrice = Math.max(
      10,
      Math.round(basePrice + wave + n * Math.sqrt(i + 1))
    )

    const vol =
      Math.round(
        (300 + seededNoise(numericSeed + 7, i) * 900) * (i < 4 ? 2.0 : 1)
      ) * 100

    rawPoints.push({
      time: timeStr,
      timestamp: Date.now() - (pointsCount - i) * 60000,
      price: currentPrice,
      typicalPrice: currentPrice,
      volume: vol,
    })
  }

  return enrichWithVwapAndBollinger(rawPoints, 20)
}

export const VwapChartCard: React.FC = () => {
  const { oco, updateOco, savedStocks, showToast } = useStockStore()

  const [selectedCode, setSelectedCode] = useState('7011')
  const [selectedName, setSelectedName] = useState('三菱重工')
  const [codeInput, setCodeInput] = useState('7011')
  const [interval, setIntervalType] = useState<'1m' | '5m'>('5m')
  const [isLoading, setIsLoading] = useState(false)
  const [dataSourceLabel, setDataSourceLabel] = useState<string>('自動更新OFF')
  const [prevClose, setPrevClose] = useState<number | null>(null)
  const [chartData, setChartData] = useState<VwapDataPoint[]>([])

  // Bollinger Band display settings
  const [bandMode, setBandMode] = useState<BandMode>('bollinger')
  const [show3Sigma, setShow3Sigma] = useState<boolean>(false)

  // Horizontal Click-and-Drag Pan & Zoom state
  const [zoom, setZoom] = useState<number>(1.8)
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
  const overscrollMargin = Math.round(viewportWidth * 0.25)
  const minPanX = -(canvasWidth - viewportWidth) - overscrollMargin
  const maxPanX = overscrollMargin

  const handleChangeZoom = (nextZoom: number) => {
    const clampedZoom = clamp(Number(nextZoom.toFixed(2)), 1.0, 4.0)
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
        points: enrichWithVwapAndBollinger(rawPoints, 20),
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
    async (codeToFetch: string, intervalToFetch: '1m' | '5m') => {
      setIsLoading(true)
      const cleanCode = codeToFetch.trim().toUpperCase()
      const yahooSym =
        /^\d{4}$/.test(cleanCode) || /^\d{3}[A-Z]$/.test(cleanCode)
          ? `${cleanCode}.T`
          : cleanCode

      try {
        // 1. Try Vercel Serverless Function `/api/chart`
        const apiRes = await fetch(
          `/api/chart?symbol=${encodeURIComponent(
            yahooSym
          )}&interval=${intervalToFetch}&range=1d`
        )
        if (apiRes.ok) {
          const json = await apiRes.json()
          const parsed = parseYahooChartAndComputeVwap(json.data)
          if (parsed && parsed.points.length > 0) {
            setChartData(parsed.points)
            setPrevClose(parsed.previousClose)
            setPanX(0)
            const nowStr = new Date().toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
            })
            setDataSourceLabel(`東証データ (${nowStr}取得・自動更新OFF)`)
            setIsLoading(false)
            return
          }
        }

        // 2. Try local Vite dev server proxy `/yahoo-api`
        const viteProxyRes = await fetch(
          `/yahoo-api/v8/finance/chart/${encodeURIComponent(
            yahooSym
          )}?interval=${intervalToFetch}&range=1d&includePrePost=false`
        )
        if (viteProxyRes.ok) {
          const rawData = await viteProxyRes.json()
          const parsed = parseYahooChartAndComputeVwap(rawData)
          if (parsed && parsed.points.length > 0) {
            setChartData(parsed.points)
            setPrevClose(parsed.previousClose)
            setPanX(0)
            const nowStr = new Date().toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
            })
            setDataSourceLabel(`東証データ (${nowStr}取得・自動更新OFF)`)
            setIsLoading(false)
            return
          }
        }

        throw new Error('Fallback to simulated intraday data')
      } catch {
        const matched = tickerListRef.current.find((t) => t.code === cleanCode)
        const base = matched?.basePrice || 2000
        const sim = generateSimulatedSession(base, cleanCode, 54)
        setChartData(sim)
        setPrevClose(base)
        setPanX(0)
        setDataSourceLabel('シミュレーション波形（自動更新OFF）')
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

  // Active band values on latest point for summary display
  const activeUpper2 = latestPoint
    ? bandMode === 'vwap_band'
      ? latestPoint.vwapUpper2
      : latestPoint.bbUpper2
    : 0
  const activeLower2 = latestPoint
    ? bandMode === 'vwap_band'
      ? latestPoint.vwapLower2
      : latestPoint.bbLower2
    : 0
  const activeSigmaScore = useMemo(() => {
    if (!latestPoint) return 0
    if (bandMode === 'vwap_band') {
      return latestPoint.vwapSigma > 0
        ? (latestPoint.price - latestPoint.vwap) / latestPoint.vwapSigma
        : 0
    }
    return latestPoint.bbSigma > 0
      ? (latestPoint.price - latestPoint.bbMiddle) / latestPoint.bbSigma
      : 0
  }, [latestPoint, bandMode])

  // Compute 5 evenly spaced Y-axis ticks including Bollinger Bands so nothing gets clipped
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
      minVal = Math.min(minVal, pt.price, pt.vwap)
      maxVal = Math.max(maxVal, pt.price, pt.vwap)
      if (bandMode === 'bollinger') {
        minVal = Math.min(minVal, show3Sigma ? pt.bbLower3 : pt.bbLower2)
        maxVal = Math.max(maxVal, show3Sigma ? pt.bbUpper3 : pt.bbUpper2)
      } else if (bandMode === 'vwap_band') {
        minVal = Math.min(minVal, show3Sigma ? pt.vwapLower3 : pt.vwapLower2)
        maxVal = Math.max(maxVal, show3Sigma ? pt.vwapUpper3 : pt.vwapUpper2)
      }
    }
    if (prevClose && Number.isFinite(prevClose)) {
      minVal = Math.min(minVal, prevClose)
      maxVal = Math.max(maxVal, prevClose)
    }
    const pad = Math.max(2, Math.round((maxVal - minVal) * 0.08))
    const rawMin = Math.floor(minVal - pad)
    const rawMax = Math.ceil(maxVal + pad)
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
  }, [chartData, prevClose, bandMode, show3Sigma])

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

  // Data keys based on selected band mode
  const range2Key = bandMode === 'vwap_band' ? 'vwapRange2' : 'bbRange2'
  const range1Key = bandMode === 'vwap_band' ? 'vwapRange1' : 'bbRange1'
  const upper3Key = bandMode === 'vwap_band' ? 'vwapUpper3' : 'bbUpper3'
  const lower3Key = bandMode === 'vwap_band' ? 'vwapLower3' : 'bbLower3'
  const upper2Key = bandMode === 'vwap_band' ? 'vwapUpper2' : 'bbUpper2'
  const lower2Key = bandMode === 'vwap_band' ? 'vwapLower2' : 'bbLower2'
  const upper1Key = bandMode === 'vwap_band' ? 'vwapUpper1' : 'bbUpper1'
  const lower1Key = bandMode === 'vwap_band' ? 'vwapLower1' : 'bbLower1'

  return (
    <div className="bg-[#1e2433] text-white rounded-3xl p-4 shadow-xl border border-slate-700/80 space-y-3.5">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm sm:text-base font-extrabold text-white">
              銘柄別 VWAP ＆ ボリンジャーバンド
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            {dataSourceLabel}
          </span>
        </div>

        {/* 1m / 5m + Manual Refresh */}
        <div className="flex items-center gap-1.5">
          <div className="bg-[#0f172a] p-0.5 rounded-lg border border-slate-700 flex text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setIntervalType('1m')}
              className={`px-2.5 py-1 rounded-md transition ${
                interval === '1m'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1分足
            </button>
            <button
              type="button"
              onClick={() => setIntervalType('5m')}
              className={`px-2.5 py-1 rounded-md transition ${
                interval === '5m'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              5分足
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

      {/* Bollinger Band Mode Selector Bar */}
      <div className="bg-[#0f172a] rounded-2xl p-2.5 border border-slate-700/90 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span className="text-xs font-extrabold text-slate-200">
            ボリンジャーバンド表示：
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="bg-slate-900 p-0.5 rounded-xl border border-slate-700 flex text-[11px] font-extrabold">
            <button
              type="button"
              onClick={() => setBandMode('bollinger')}
              className={`px-2.5 py-1 rounded-lg transition ${
                bandMode === 'bollinger'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              BB(20) ±1σ/±2σ
            </button>
            <button
              type="button"
              onClick={() => setBandMode('vwap_band')}
              className={`px-2.5 py-1 rounded-lg transition ${
                bandMode === 'vwap_band'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              VWAP ±1σ/±2σ
            </button>
            <button
              type="button"
              onClick={() => setBandMode('off')}
              className={`px-2 py-1 rounded-lg transition ${
                bandMode === 'off'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              OFF
            </button>
          </div>

          {bandMode !== 'off' && (
            <button
              type="button"
              onClick={() => setShow3Sigma(!show3Sigma)}
              className={`px-2 py-1 rounded-xl text-[10px] font-extrabold border transition ${
                show3Sigma
                  ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/50'
                  : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}
            >
              ±3σ {show3Sigma ? 'ON' : 'OFF'}
            </button>
          )}
        </div>
      </div>

      {/* Current Price vs VWAP & Bollinger Band Summary Banner */}
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
            現在VWAP
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
            {bandMode === 'vwap_band' ? 'VWAPバンド位置' : 'ボリンジャー位置'}
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

      {/* Click-and-Drag Pannable Composed Chart: Price + VWAP + Bollinger Bands */}
      <div className="bg-[#0f172a] rounded-2xl p-3 border border-slate-700/80 space-y-2">
        <div className="flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-200">
              {selectedCode} {selectedName}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/15 text-sky-300 border border-sky-500/30">
              <MoveHorizontal className="w-3 h-3" />
              クリック＆ドラッグで左右移動
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="inline-flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-700 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => handleChangeZoom(zoom - 0.4)}
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
                onClick={() => handleChangeZoom(1.8)}
                className={`px-1.5 py-0.5 rounded ${
                  Math.abs(zoom - 1.8) < 0.2
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                1.8x
              </button>
              <button
                type="button"
                onClick={() => handleChangeZoom(3.0)}
                className={`px-1.5 py-0.5 rounded ${
                  zoom >= 2.6
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                3.0x
              </button>
              <button
                type="button"
                onClick={() => handleChangeZoom(zoom + 0.4)}
                className="p-1 text-slate-300 hover:text-white active:scale-95"
                title="拡大"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold">
          <span className="flex items-center gap-1 text-[#38bdf8]">
            <span className="w-3 h-0.5 bg-[#38bdf8] inline-block" />
            株価
          </span>
          <span className="flex items-center gap-1 text-[#f59e0b]">
            <span className="w-3.5 h-1 bg-[#f59e0b] inline-block rounded-full" />
            VWAP
          </span>
          {bandMode === 'bollinger' && (
            <span className="flex items-center gap-1 text-purple-400">
              <span className="w-3 h-0.5 bg-purple-400 inline-block" />
              SMA(20)
            </span>
          )}
          {bandMode !== 'off' && (
            <>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-3 h-0.5 border-b-2 border-dashed border-rose-400 inline-block" />
                +2σ
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2.5 h-0.5 border-b border-dashed border-slate-400 inline-block" />
                ±1σ
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-3 h-0.5 border-b-2 border-dashed border-emerald-400 inline-block" />
                -2σ
              </span>
              {show3Sigma && (
                <span className="flex items-center gap-1 text-fuchsia-400">
                  <span className="w-2.5 h-0.5 border-b border-dotted border-fuchsia-400 inline-block" />
                  ±3σ
                </span>
              )}
            </>
          )}
        </div>

        {/* Interactive Click-and-Drag Chart Box */}
        <div className="relative rounded-xl border border-slate-800 bg-[#0b1120] overflow-hidden">
          <div className="flex">
            {/* Pinned Left Y-Axis Column */}
            <div className="w-12 shrink-0 border-r border-slate-800/90 bg-[#0f172a]/95 z-10 select-none">
              <div className="h-64 pt-[8px] pb-[22px] px-1.5 flex flex-col justify-between items-end text-[10px] font-mono text-slate-400">
                {yTicks.map((t) => (
                  <span key={t} className="leading-none">
                    {t}
                  </span>
                ))}
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
                className="h-64 will-change-transform"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 8, right: 20, left: 10, bottom: 0 }}
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
                      minTickGap={20}
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
                        const diff = pt.price - pt.vwap
                        const diffPct = pt.vwap > 0 ? (diff / pt.vwap) * 100 : 0
                        const u2 =
                          bandMode === 'vwap_band' ? pt.vwapUpper2 : pt.bbUpper2
                        const u1 =
                          bandMode === 'vwap_band' ? pt.vwapUpper1 : pt.bbUpper1
                        const l1 =
                          bandMode === 'vwap_band' ? pt.vwapLower1 : pt.bbLower1
                        const l2 =
                          bandMode === 'vwap_band' ? pt.vwapLower2 : pt.bbLower2
                        return (
                          <div className="bg-slate-900/95 border border-slate-600 rounded-xl p-2.5 text-xs shadow-xl space-y-1 min-w-[195px]">
                            <div className="font-bold text-slate-300 border-b border-slate-700 pb-1">
                              ⏰ {pt.time} 時点
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[#38bdf8] font-bold">
                                株価：
                              </span>
                              <span className="font-extrabold text-white font-mono">
                                {pt.price.toLocaleString()} 円
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[#f59e0b] font-bold">
                                VWAP：
                              </span>
                              <span className="font-extrabold text-[#f59e0b] font-mono">
                                {pt.vwap.toLocaleString()} 円
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-400">VWAP乖離：</span>
                              <span
                                className={`font-bold font-mono ${
                                  diff >= 0
                                    ? 'text-emerald-400'
                                    : 'text-rose-400'
                                }`}
                              >
                                {diff >= 0 ? '+' : ''}
                                {diff.toFixed(1)}円 ({diffPct >= 0 ? '+' : ''}
                                {diffPct.toFixed(2)}%)
                              </span>
                            </div>
                            {bandMode !== 'off' && (
                              <div className="border-t border-slate-800 pt-1 mt-1 space-y-0.5 text-[11px]">
                                {bandMode === 'bollinger' && (
                                  <div className="flex justify-between text-purple-300">
                                    <span>SMA(20) 中央線：</span>
                                    <span className="font-mono font-bold">
                                      {pt.bbMiddle.toLocaleString()} 円
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between text-rose-300">
                                  <span>+2σ バンド：</span>
                                  <span className="font-mono font-bold">
                                    {u2.toLocaleString()} 円
                                  </span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                  <span>±1σ レンジ：</span>
                                  <span className="font-mono">
                                    {l1.toLocaleString()} 〜{' '}
                                    {u1.toLocaleString()} 円
                                  </span>
                                </div>
                                <div className="flex justify-between text-emerald-300">
                                  <span>-2σ バンド：</span>
                                  <span className="font-mono font-bold">
                                    {l2.toLocaleString()} 円
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      }}
                    />

                    {prevClose && (
                      <ReferenceLine
                        y={prevClose}
                        stroke="#64748b"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                      />
                    )}

                    {/* Bollinger Band Shaded Ribbon Area (±2σ and ±1σ) */}
                    {bandMode !== 'off' && (
                      <>
                        <Area
                          type="monotone"
                          dataKey={range2Key}
                          stroke="none"
                          fill={
                            bandMode === 'bollinger' ? '#a855f7' : '#38bdf8'
                          }
                          fillOpacity={0.08}
                          isAnimationActive={false}
                        />
                        <Area
                          type="monotone"
                          dataKey={range1Key}
                          stroke="none"
                          fill={
                            bandMode === 'bollinger' ? '#a855f7' : '#38bdf8'
                          }
                          fillOpacity={0.12}
                          isAnimationActive={false}
                        />
                      </>
                    )}

                    {/* ±3σ Lines (Optional) */}
                    {bandMode !== 'off' && show3Sigma && (
                      <>
                        <Line
                          type="monotone"
                          dataKey={upper3Key}
                          stroke="#e879f9"
                          strokeWidth={1.2}
                          strokeDasharray="2 3"
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey={lower3Key}
                          stroke="#e879f9"
                          strokeWidth={1.2}
                          strokeDasharray="2 3"
                          dot={false}
                          isAnimationActive={false}
                        />
                      </>
                    )}

                    {/* ±2σ Lines */}
                    {bandMode !== 'off' && (
                      <>
                        <Line
                          type="monotone"
                          dataKey={upper2Key}
                          stroke="#fb7185"
                          strokeWidth={1.6}
                          strokeDasharray="5 3"
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey={lower2Key}
                          stroke="#34d399"
                          strokeWidth={1.6}
                          strokeDasharray="5 3"
                          dot={false}
                          isAnimationActive={false}
                        />
                      </>
                    )}

                    {/* ±1σ Lines */}
                    {bandMode !== 'off' && (
                      <>
                        <Line
                          type="monotone"
                          dataKey={upper1Key}
                          stroke="#94a3b8"
                          strokeWidth={1.1}
                          strokeDasharray="3 3"
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey={lower1Key}
                          stroke="#94a3b8"
                          strokeWidth={1.1}
                          strokeDasharray="3 3"
                          dot={false}
                          isAnimationActive={false}
                        />
                      </>
                    )}

                    {/* SMA(20) Middle Line when in standard Bollinger Band mode */}
                    {bandMode === 'bollinger' && (
                      <Line
                        type="monotone"
                        dataKey="bbMiddle"
                        stroke="#a78bfa"
                        strokeWidth={1.6}
                        dot={false}
                        isAnimationActive={false}
                      />
                    )}

                    {/* VWAP Line (Gold/Amber) */}
                    <Line
                      type="monotone"
                      dataKey="vwap"
                      name="VWAP"
                      stroke="#f59e0b"
                      strokeWidth={2.6}
                      dot={false}
                      isAnimationActive={false}
                    />

                    {/* Intraday Price Line (Sky Blue) */}
                    <Line
                      type="monotone"
                      dataKey="price"
                      name="株価"
                      stroke="#38bdf8"
                      strokeWidth={2.3}
                      dot={{ r: 2, fill: '#38bdf8', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#38bdf8', stroke: '#fff' }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
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
