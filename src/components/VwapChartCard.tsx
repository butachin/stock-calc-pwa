import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
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
  volume: number
  cumVolume: number
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

// Generate realistic deterministic intraday points & cumulative VWAP
function generateSimulatedSession(
  basePrice: number,
  codeSeedStr = '7011',
  pointsCount = 54
): VwapDataPoint[] {
  const result: VwapDataPoint[] = []
  let currentPrice = basePrice
  let cumPV = 0
  let cumVol = 0

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
    cumPV += currentPrice * vol
    cumVol += vol
    const vwap = Math.round((cumPV / cumVol) * 10) / 10

    result.push({
      time: timeStr,
      timestamp: Date.now() - (pointsCount - i) * 60000,
      price: currentPrice,
      vwap,
      volume: vol,
      cumVolume: cumVol,
    })
  }
  return result
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

  // Parse Yahoo Finance v8 chart response and compute cumulative Intraday VWAP
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

      let cumPV = 0
      let cumVol = 0
      const points: VwapDataPoint[] = []

      for (let i = 0; i < timestamps.length; i++) {
        const c = closes[i]
        if (c === null || c === undefined || !Number.isFinite(c)) continue

        const h = highs[i] ?? c
        const l = lows[i] ?? c
        const v = Math.max(0, volumes[i] ?? 0)

        const typicalPrice = (h + l + c) / 3

        if (v > 0) {
          cumPV += typicalPrice * v
          cumVol += v
        } else if (cumVol === 0) {
          cumPV = c
          cumVol = 1
        }

        const vwap = cumVol > 0 ? Math.round((cumPV / cumVol) * 10) / 10 : c
        const date = new Date(timestamps[i] * 1000)
        const jstStr = date.toLocaleTimeString('ja-JP', {
          timeZone: 'Asia/Tokyo',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })

        points.push({
          time: jstStr,
          timestamp: timestamps[i] * 1000,
          price: Math.round(c * 10) / 10,
          vwap,
          volume: v || 1000,
          cumVolume: cumVol,
        })
      }

      return {
        points,
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

  // Compute 5 evenly spaced Y-axis ticks so the pinned left Y-axis and horizontal grid lines align 100%
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
      if (pt.price < minVal) minVal = pt.price
      if (pt.price > maxVal) maxVal = pt.price
      if (pt.vwap < minVal) minVal = pt.vwap
      if (pt.vwap > maxVal) maxVal = pt.vwap
    }
    if (prevClose && Number.isFinite(prevClose)) {
      minVal = Math.min(minVal, prevClose)
      maxVal = Math.max(maxVal, prevClose)
    }
    const pad = Math.max(2, Math.round((maxVal - minVal) * 0.12))
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
  }, [chartData, prevClose])

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
              銘柄別 株価 ＆ VWAPチャート
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

      {/* Current Price vs VWAP Summary Banner */}
      <div className="grid grid-cols-3 gap-2 bg-[#0f172a] rounded-2xl p-3 border border-slate-700/90 items-center">
        <div>
          <div className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#38bdf8] inline-block" />
            現在株価 ({selectedCode})
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#38bdf8] tracking-tight mt-0.5">
            {currentPrice > 0 ? `${formatNumber(currentPrice, 1)}円` : '---'}
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
        </div>

        <div className="text-right">
          <div className="text-[10px] text-slate-400 font-bold">VWAP乖離</div>
          <div
            className={`inline-flex items-center gap-0.5 text-xs sm:text-sm font-extrabold mt-0.5 ${
              isAboveVwap ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isAboveVwap ? (
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
            )}
            {vwapDiff >= 0 ? '+' : ''}
            {vwapDiff.toFixed(1)}円 ({vwapDiffPercent >= 0 ? '+' : ''}
            {vwapDiffPercent.toFixed(2)}%)
          </div>
          <div className="mt-0.5">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                isAboveVwap
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}
            >
              {isAboveVwap ? '📈 VWAP上 (買い優勢)' : '📉 VWAP下 (売り優勢)'}
            </span>
          </div>
        </div>
      </div>

      {/* Click-and-Drag Pannable Line Chart: Price + VWAP */}
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
        <div className="flex items-center gap-3 text-[11px] font-bold">
          <span className="flex items-center gap-1 text-[#38bdf8]">
            <span className="w-3 h-0.5 bg-[#38bdf8] inline-block" />
            株価
          </span>
          <span className="flex items-center gap-1 text-[#f59e0b]">
            <span className="w-3 h-0.5 bg-[#f59e0b] inline-block" />
            VWAP
          </span>
          {prevClose && (
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2.5 h-0.5 border-b border-dashed border-slate-400 inline-block" />
              前日終値
            </span>
          )}
        </div>

        {/* Interactive Click-and-Drag Chart Box */}
        <div className="relative rounded-xl border border-slate-800 bg-[#0b1120] overflow-hidden">
          <div className="flex">
            {/* Pinned Left Y-Axis Column */}
            <div className="w-12 shrink-0 border-r border-slate-800/90 bg-[#0f172a]/95 z-10 select-none">
              <div className="h-56 pt-[8px] pb-[22px] px-1.5 flex flex-col justify-between items-end text-[10px] font-mono text-slate-400">
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
                className="h-56 will-change-transform"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
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
                        return (
                          <div className="bg-slate-900/95 border border-slate-600 rounded-xl p-2.5 text-xs shadow-xl space-y-1">
                            <div className="font-bold text-slate-300 border-b border-slate-700 pb-1">
                              ⏰ {pt.time} 時点
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[#38bdf8] font-bold">
                                株価：
                              </span>
                              <span className="font-extrabold text-white">
                                {pt.price.toLocaleString()} 円
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[#f59e0b] font-bold">
                                VWAP：
                              </span>
                              <span className="font-extrabold text-[#f59e0b]">
                                {pt.vwap.toLocaleString()} 円
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-400">VWAP乖離：</span>
                              <span
                                className={`font-bold ${
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
                    {/* VWAP Line (Gold/Amber) */}
                    <Line
                      type="monotone"
                      dataKey="vwap"
                      name="VWAP"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                    {/* Intraday Price Line (Sky Blue) */}
                    <Line
                      type="monotone"
                      dataKey="price"
                      name="株価"
                      stroke="#38bdf8"
                      strokeWidth={2.2}
                      dot={{ r: 2, fill: '#38bdf8', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#38bdf8', stroke: '#fff' }}
                      isAnimationActive={false}
                    />
                  </LineChart>
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
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => applyPriceToOco(currentPrice, '現在値')}
          className="py-2.5 px-3 rounded-xl bg-[#38bdf8]/15 hover:bg-[#38bdf8]/25 border border-[#38bdf8]/50 text-[#38bdf8] text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          現在値 ({Math.round(currentPrice).toLocaleString()}円) をOCOへ
        </button>

        <button
          type="button"
          onClick={() => applyPriceToOco(currentVwap, 'VWAP値')}
          className="py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/50 text-amber-300 text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition"
        >
          <Activity className="w-3.5 h-3.5" />
          VWAP ({Math.round(currentVwap).toLocaleString()}円) をOCOへ
        </button>
      </div>
    </div>
  )
}
