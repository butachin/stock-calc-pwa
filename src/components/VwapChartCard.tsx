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
  Play,
  RefreshCw,
  Search,
  Zap,
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

// Helper to generate realistic intraday points & cumulative VWAP (used for live demo mode or fallback)
function generateSimulatedSession(basePrice: number, pointsCount = 45): VwapDataPoint[] {
  const result: VwapDataPoint[] = []
  let currentPrice = basePrice
  let cumPV = 0
  let cumVol = 0

  const startHour = 9
  const startMin = 0

  for (let i = 0; i < pointsCount; i++) {
    const totalMins = startMin + i * 2
    const h = startHour + Math.floor(totalMins / 60)
    const m = totalMins % 60
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

    // Slight trend + oscillation around VWAP
    const wave = Math.sin(i / 6) * (basePrice * 0.0035)
    const noise = (Math.random() - 0.48) * (basePrice * 0.004)
    currentPrice = Math.max(10, Math.round(basePrice + wave + noise * Math.sqrt(i + 1)))

    const vol = Math.round((300 + Math.random() * 900) * (i < 5 ? 2.2 : 1)) * 100
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
  const [interval, setIntervalType] = useState<'1m' | '5m'>('1m')
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)
  const [isDemoLive, setIsDemoLive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [dataSourceLabel, setDataSourceLabel] = useState<string>('東証データ取得中...')
  const [prevClose, setPrevClose] = useState<number | null>(null)
  const [chartData, setChartData] = useState<VwapDataPoint[]>([])

  const cumPVRef = useRef(0)
  const cumVolRef = useRef(0)

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

        // Typical price for bar = (High + Low + Close) / 3
        const typicalPrice = (h + l + c) / 3

        if (v > 0) {
          cumPV += typicalPrice * v
          cumVol += v
        } else if (cumVol === 0) {
          // First bar with 0 volume fallback
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
          volume: v,
          cumVolume: cumVol,
        })
      }

      cumPVRef.current = cumPV
      cumVolRef.current = cumVol

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
            const nowStr = new Date().toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
            setDataSourceLabel(`東証データ (${nowStr}更新)`)
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
            const nowStr = new Date().toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
            setDataSourceLabel(`東証データ (${nowStr}更新)`)
            setIsLoading(false)
            return
          }
        }

        // 3. Fallback: public CORS proxy if static hosted without /api/chart
        const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          yahooSym
        )}?interval=${intervalToFetch}&range=1d&includePrePost=false`
        const proxyRes = await fetch(
          `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
        )
        if (proxyRes.ok) {
          const rawData = await proxyRes.json()
          const parsed = parseYahooChartAndComputeVwap(rawData)
          if (parsed && parsed.points.length > 0) {
            setChartData(parsed.points)
            setPrevClose(parsed.previousClose)
            const nowStr = new Date().toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
            setDataSourceLabel(`東証データ (${nowStr}更新)`)
            setIsLoading(false)
            return
          }
        }

        throw new Error('Fallback to simulated intraday data')
      } catch {
        // 3. Fallback to realistic simulated intraday session so chart always works offline
        const matched = tickerList.find((t) => t.code === cleanCode)
        const base = matched?.basePrice || parseFloat(oco.priceInput) || 2000
        const sim = generateSimulatedSession(base, 45)
        setChartData(sim)
        setPrevClose(base)
        setDataSourceLabel('シミュレーション表示中')
      } finally {
        setIsLoading(false)
      }
    },
    [oco.priceInput, tickerList]
  )

  // Initial & symbol/interval change fetch
  useEffect(() => {
    if (!isDemoLive) {
      void fetchIntradayData(selectedCode, interval)
    }
  }, [selectedCode, interval, isDemoLive, fetchIntradayData])

  // Auto-refresh every 12 seconds when LIVE auto-refresh is enabled (and not in demo tick mode)
  useEffect(() => {
    if (!isAutoRefresh || isDemoLive) return
    const timer = window.setInterval(() => {
      void fetchIntradayData(selectedCode, interval)
    }, 12000)
    return () => window.clearInterval(timer)
  }, [isAutoRefresh, isDemoLive, selectedCode, interval, fetchIntradayData])

  // Demo real-time tick mode (ticks every 1.5 seconds so the user can test live VWAP crossover anytime, even at night!)
  useEffect(() => {
    if (!isDemoLive) return
    const timer = window.setInterval(() => {
      setChartData((prev) => {
        if (prev.length === 0) return prev
        const last = prev[prev.length - 1]
        const step = Math.max(1, Math.round(last.price * 0.0025))
        const delta = Math.round((Math.random() - 0.48) * step * 2)
        const nextPrice = Math.max(10, last.price + delta)
        const tickVol = Math.round(200 + Math.random() * 800) * 100

        const prevCumVol = last.cumVolume || 100000
        const prevCumPV = last.vwap * prevCumVol
        const nextCumVol = prevCumVol + tickVol
        const nextCumPV = prevCumPV + nextPrice * tickVol
        const nextVwap = Math.round((nextCumPV / nextCumVol) * 10) / 10

        const now = new Date()
        const timeLabel = now.toLocaleTimeString('ja-JP', {
          minute: '2-digit',
          second: '2-digit',
        })

        const nextPoint: VwapDataPoint = {
          time: timeLabel,
          timestamp: Date.now(),
          price: nextPrice,
          vwap: nextVwap,
          volume: tickVol,
          cumVolume: nextCumVol,
        }
        return [...prev.slice(-59), nextPoint]
      })
    }, 1500)
    return () => window.clearInterval(timer)
  }, [isDemoLive])

  const latestPoint =
    chartData.length > 0 ? chartData[chartData.length - 1] : null
  const currentPrice = latestPoint ? latestPoint.price : 0
  const currentVwap = latestPoint ? latestPoint.vwap : 0
  const vwapDiff = currentPrice - currentVwap
  const vwapDiffPercent =
    currentVwap > 0 ? (vwapDiff / currentVwap) * 100 : 0
  const isAboveVwap = vwapDiff >= 0

  // Compute chart Y-axis domain with padding so price and VWAP lines are clearly visible
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return ['auto', 'auto']
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
    return [Math.floor(minVal - pad), Math.ceil(maxVal + pad)]
  }, [chartData, prevClose])

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
      {/* Top Header: Title + Live Status + Interval Toggle */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm sm:text-base font-extrabold text-white">
              リアルタイム株価 ＆ VWAPチャート
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isDemoLive || isAutoRefresh
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-slate-400'
              }`}
            />
            {isDemoLive ? 'ライブ値動きデモ中' : dataSourceLabel}
          </span>
        </div>

        {/* 1m / 5m + Demo Mode + Manual Refresh */}
        <div className="flex items-center gap-1.5">
          <div className="bg-[#0f172a] p-0.5 rounded-lg border border-slate-700 flex text-[11px] font-bold">
            <button
              type="button"
              onClick={() => {
                setIsDemoLive(false)
                setIntervalType('1m')
              }}
              className={`px-2 py-1 rounded-md transition ${
                !isDemoLive && interval === '1m'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1分足
            </button>
            <button
              type="button"
              onClick={() => {
                setIsDemoLive(false)
                setIntervalType('5m')
              }}
              className={`px-2 py-1 rounded-md transition ${
                !isDemoLive && interval === '5m'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              5分足
            </button>
            <button
              type="button"
              onClick={() => setIsDemoLive(!isDemoLive)}
              className={`px-2 py-1 rounded-md flex items-center gap-0.5 transition ${
                isDemoLive
                  ? 'bg-amber-500 text-slate-950 font-extrabold'
                  : 'text-amber-300 hover:text-amber-200'
              }`}
              title="夜間や休場中でもリアルタイムに株価とVWAPが動くデモモード"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              デモ稼働
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsDemoLive(false)
              void fetchIntradayData(selectedCode, interval)
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 active:scale-95 transition"
            title="最新データを再取得"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Stock Picker Row: Quick Preset Chips + 4-digit Code Search */}
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
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 shrink-0 active:scale-95 transition"
          >
            銘柄切替
          </button>
          <button
            type="button"
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold shrink-0 transition ${
              isAutoRefresh
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {isAutoRefresh ? '自動更新ON' : '自動更新OFF'}
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

      {/* Real-time Line Chart: Price + VWAP */}
      <div className="bg-[#0f172a] rounded-2xl p-3 border border-slate-700/80">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-bold text-slate-300">
            {selectedCode} {selectedName}（株価 ＆ VWAP 推移）
          </span>
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
        </div>

        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 6, right: 8, left: -12, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e293b"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                domain={yDomain}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const pt = payload[0].payload as VwapDataPoint
                  const diff = pt.price - pt.vwap
                  const diffPct = pt.vwap > 0 ? (diff / pt.vwap) * 100 : 0
                  return (
                    <div className="bg-slate-900/95 border border-slate-600 rounded-xl p-2.5 text-xs shadow-xl space-y-1">
                      <div className="font-bold text-slate-300 border-b border-slate-700 pb-1">
                        ⏰ {pt.time} 時点
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[#38bdf8] font-bold">株価：</span>
                        <span className="font-extrabold text-white">
                          {pt.price.toLocaleString()} 円
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[#f59e0b] font-bold">VWAP：</span>
                        <span className="font-extrabold text-[#f59e0b]">
                          {pt.vwap.toLocaleString()} 円
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-400">VWAP乖離：</span>
                        <span
                          className={`font-bold ${
                            diff >= 0 ? 'text-emerald-400' : 'text-rose-400'
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
                dot={false}
                activeDot={{ r: 4, fill: '#38bdf8', stroke: '#fff' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
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
