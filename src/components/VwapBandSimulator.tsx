import React, { useEffect, useMemo, useRef, useState } from 'react'
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
  CheckCircle2,
  MoveHorizontal,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Sparkles,
  Target,
  TrendingUp,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { VwapChartCard } from './VwapChartCard'

// ============================================================================
// 型定義および3パターンの日中基準時系列データ（09:00〜15:30 完全収録）
// ============================================================================

export type PatternKey = 'pullback' | 'breakout' | 'rejection'

export interface IntradayBasePoint {
  time: string
  basePrice: number
  baseVolume: number
  isInflection?: boolean
  signalLabel?: string
  signalType?: 'entry_buy' | 'entry_sell' | 'take_profit' | 'stop_loss_ref'
}

export interface CalculatedIntradayPoint extends IntradayBasePoint {
  price: number
  volume: number
  vwap: number
  vwapRounded: number
  sigma: number
  upperBand1Sigma: number
  lowerBand1Sigma: number
  upperBand2Sigma: number
  lowerBand2Sigma: number
  upperBand3Sigma: number
  lowerBand3Sigma: number
  bandRange2Sigma: [number, number]
  bandRange1Sigma: [number, number]
  // Standard SMA Bollinger Bands
  bbMiddle: number
  bbUpper2: number
  bbLower2: number
  bbRange2: [number, number]
  vwapDeviationRate: number
}

export const INTRADAY_PATTERNS: Record<
  PatternKey,
  {
    title: string
    shortLabel: string
    entryRule: string
    takeProfitRule: string
    stopLossRule: string
    points: IntradayBasePoint[]
  }
> = {
  pullback: {
    title: '① VWAP押し目買い（強気トレンドの順張り）',
    shortLabel: '① 押し目買い',
    entryRule:
      '上昇後に調整し、VWAP付近まで下がって反発したポイント（10:15 / 13:15）で買いエントリー',
    takeProfitRule:
      '直近高値ブレイク後、VWAP+2σ（ボリンジャー+2σ）バンド付近に到達して伸びが鈍化した局面で利確',
    stopLossRule:
      '出来高を伴ってVWAPを明確に下抜けし、数分以内にVWAP上へ復帰できない場合は即損切り',
    points: [
      { time: '09:00', basePrice: 5000, baseVolume: 1200, isInflection: true },
      { time: '09:15', basePrice: 5055, baseVolume: 950 },
      { time: '09:30', basePrice: 5105, baseVolume: 1100, isInflection: true },
      { time: '09:45', basePrice: 5120, baseVolume: 700 },
      { time: '10:00', basePrice: 5085, baseVolume: 500 },
      {
        time: '10:15',
        basePrice: 5065,
        baseVolume: 1300,
        isInflection: true,
        signalLabel: '第1押し目買い好機',
        signalType: 'entry_buy',
      },
      { time: '10:30', basePrice: 5110, baseVolume: 850 },
      { time: '10:45', basePrice: 5145, baseVolume: 900 },
      { time: '11:00', basePrice: 5165, baseVolume: 750 },
      { time: '11:30', basePrice: 5180, baseVolume: 800 },
      { time: '12:30', basePrice: 5155, baseVolume: 600 },
      { time: '13:00', basePrice: 5130, baseVolume: 550 },
      {
        time: '13:15',
        basePrice: 5115,
        baseVolume: 1400,
        isInflection: true,
        signalLabel: '第2押し目買い好機',
        signalType: 'entry_buy',
      },
      { time: '13:45', basePrice: 5160, baseVolume: 900 },
      { time: '14:15', basePrice: 5195, baseVolume: 1000 },
      { time: '14:45', basePrice: 5225, baseVolume: 1150 },
      {
        time: '15:00',
        basePrice: 5245,
        baseVolume: 1300,
        signalLabel: '+2σ利確目安',
        signalType: 'take_profit',
      },
      { time: '15:30', basePrice: 5240, baseVolume: 1600 },
    ],
  },
  breakout: {
    title: '② VWAPブレイクアウト（弱気から強気へのトレンド転換）',
    shortLabel: '② ブレイクアウト',
    entryRule:
      '前場VWAP下で推移した後、大口出来高でVWAPを上抜け(11:15)、後場にVWAPでサポレジ転換を確認した地点(12:45)で買い',
    takeProfitRule:
      '後場のトレンド加速で+2σバンドに接近した高値圏（15:00〜15:30）で利確',
    stopLossRule:
      'ブレイク後に再びVWAPの内側（下）へ潜り込んで定着してしまった時点で損切り',
    points: [
      { time: '09:00', basePrice: 5000, baseVolume: 1100 },
      { time: '09:15', basePrice: 4950, baseVolume: 1000, isInflection: true },
      { time: '09:30', basePrice: 4920, baseVolume: 850 },
      { time: '09:45', basePrice: 4910, baseVolume: 700 },
      { time: '10:00', basePrice: 4925, baseVolume: 600 },
      { time: '10:15', basePrice: 4935, baseVolume: 550 },
      { time: '10:30', basePrice: 4920, baseVolume: 500 },
      { time: '10:45', basePrice: 4930, baseVolume: 650 },
      { time: '11:00', basePrice: 4940, baseVolume: 800 },
      {
        time: '11:15',
        basePrice: 4970,
        baseVolume: 1800,
        isInflection: true,
        signalLabel: 'VWAP上抜けブレイク',
        signalType: 'entry_buy',
      },
      { time: '11:30', basePrice: 4985, baseVolume: 1100 },
      { time: '12:30', basePrice: 4965, baseVolume: 700 },
      {
        time: '12:45',
        basePrice: 4955,
        baseVolume: 1300,
        isInflection: true,
        signalLabel: 'サポレジ転換・第2波買い',
        signalType: 'entry_buy',
      },
      { time: '13:15', basePrice: 4995, baseVolume: 1050 },
      { time: '13:45', basePrice: 5025, baseVolume: 1100 },
      { time: '14:15', basePrice: 5050, baseVolume: 1200 },
      {
        time: '15:00',
        basePrice: 5075,
        baseVolume: 1400,
        signalLabel: '高値利確目安',
        signalType: 'take_profit',
      },
      { time: '15:30', basePrice: 5080, baseVolume: 1650 },
    ],
  },
  rejection: {
    title: '③ VWAP戻り売り（弱気トレンドの空売り・逃げ場判断）',
    shortLabel: '③ 戻り売り',
    entryRule:
      'VWAP下で推移中、自律反発でVWAPに接近して跳ね返されたポイント（10:15 / 13:30）で空売り（または買い玉の決済）',
    takeProfitRule:
      'VWAP-2σ（ボリンジャー-2σ）バンド付近まで急落し、売られすぎ水準に達した局面で買い戻し利確',
    stopLossRule:
      '出来高を伴ってVWAPを上にブレイクし、5,000円台を回復した場合は踏み上げ回避のため即損切り',
    points: [
      { time: '09:00', basePrice: 5000, baseVolume: 1300 },
      { time: '09:15', basePrice: 4920, baseVolume: 1200, isInflection: true },
      { time: '09:30', basePrice: 4860, baseVolume: 1050 },
      { time: '09:45', basePrice: 4890, baseVolume: 700 },
      { time: '10:00', basePrice: 4915, baseVolume: 650 },
      {
        time: '10:15',
        basePrice: 4930,
        baseVolume: 1400,
        isInflection: true,
        signalLabel: '第1戻り売り好機',
        signalType: 'entry_sell',
      },
      { time: '10:30', basePrice: 4885, baseVolume: 900 },
      { time: '10:45', basePrice: 4850, baseVolume: 850 },
      { time: '11:00', basePrice: 4830, baseVolume: 800 },
      { time: '11:30', basePrice: 4820, baseVolume: 750 },
      { time: '12:30', basePrice: 4845, baseVolume: 600 },
      { time: '13:00', basePrice: 4870, baseVolume: 650 },
      {
        time: '13:30',
        basePrice: 4885,
        baseVolume: 1350,
        isInflection: true,
        signalLabel: '第2戻り売り好機',
        signalType: 'entry_sell',
      },
      { time: '14:00', basePrice: 4840, baseVolume: 950 },
      { time: '14:30', basePrice: 4800, baseVolume: 1100 },
      {
        time: '15:00',
        basePrice: 4770,
        baseVolume: 1300,
        signalLabel: '-2σ買い戻し目安',
        signalType: 'take_profit',
      },
      { time: '15:30', basePrice: 4760, baseVolume: 1550 },
    ],
  },
}

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val))

export const VwapBandSimulator: React.FC = () => {
  const [viewMode, setViewMode] = useState<'simulator' | 'live'>('simulator')
  const [patternKey, setPatternKey] = useState<PatternKey>('pullback')
  const [volumeMultiplier, setVolumeMultiplier] = useState<number>(2.0)
  const [volatilityMultiplier, setVolatilityMultiplier] = useState<number>(1.0)
  const [show1Sigma, setShow1Sigma] = useState<boolean>(true)
  const [showBollingerOverlay, setShowBollingerOverlay] =
    useState<boolean>(true)

  // Horizontal Click-and-Drag Pan & Zoom state
  const [zoom, setZoom] = useState<number>(1.0)
  const [panX, setPanX] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [viewportWidth, setViewportWidth] = useState<number>(340)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const dragStartRef = useRef<{ clientX: number; startPanX: number } | null>(
    null
  )

  const activePattern = INTRADAY_PATTERNS[patternKey]

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
  }, [viewMode])

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

  // ============================================================================
  // リアルタイムVWAP＆標準偏差バンド（±2σ）＋移動平均ボリンジャーバンドの算出ロジック
  // ============================================================================
  const calculatedData = useMemo<CalculatedIntradayPoint[]>(() => {
    const basePoints = activePattern.points
    const adjustedPrices: number[] = []
    const adjustedVolumes: number[] = []
    const result: CalculatedIntradayPoint[] = []

    let cumPV = 0
    let cumV = 0
    const bbWindow = 8

    for (let k = 0; k < basePoints.length; k++) {
      const pt = basePoints[k]

      // 1. 調整後価格 P_k と調整後出来高 V_k の算出（基準値 P_0 = 5000）
      const P_k = Math.round(
        5000 + (pt.basePrice - 5000) * volatilityMultiplier
      )
      const V_k = Math.round(
        pt.baseVolume * (pt.isInflection ? volumeMultiplier : 1.0)
      )

      adjustedPrices.push(P_k)
      adjustedVolumes.push(V_k)

      // 2. 時刻 k までの累計売買代金 CumPV_k と累計出来高 CumV_k
      cumPV += P_k * V_k
      cumV += V_k

      // 3. 時刻 k の累計VWAP (VWAP_k)
      const VWAP_k = cumPV / cumV

      // 4. 出来高加重標準偏差 sigma_k および ±2σ バンド
      let weightedSquaredSum = 0
      for (let i = 0; i <= k; i++) {
        const diff = adjustedPrices[i] - VWAP_k
        weightedSquaredSum += adjustedVolumes[i] * (diff * diff)
      }
      const variance_k = weightedSquaredSum / cumV
      const sigma_k = Math.max(12, Math.sqrt(variance_k))

      const upperBand1Sigma = Math.round(VWAP_k + sigma_k)
      const lowerBand1Sigma = Math.round(VWAP_k - sigma_k)
      const upperBand2Sigma = Math.round(VWAP_k + 2 * sigma_k)
      const lowerBand2Sigma = Math.round(VWAP_k - 2 * sigma_k)
      const upperBand3Sigma = Math.round(VWAP_k + 3 * sigma_k)
      const lowerBand3Sigma = Math.round(VWAP_k - 3 * sigma_k)

      // 5. 移動平均ボリンジャーバンド (SMA ± 2σ)
      const startIdx = Math.max(0, k - bbWindow + 1)
      const slice = adjustedPrices.slice(startIdx, k + 1)
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length
      const bbVar =
        slice.reduce((acc, val) => acc + (val - mean) * (val - mean), 0) /
        slice.length
      const bbStd = Math.max(12, Math.sqrt(bbVar))
      const bbMiddle = Math.round(mean)
      const bbUpper2 = Math.round(mean + 2 * bbStd)
      const bbLower2 = Math.round(mean - 2 * bbStd)

      const vwapDeviationRate = Number(
        (((P_k - VWAP_k) / VWAP_k) * 100).toFixed(2)
      )

      result.push({
        ...pt,
        price: P_k,
        volume: V_k,
        vwap: VWAP_k,
        vwapRounded: Math.round(VWAP_k),
        sigma: Math.round(sigma_k * 10) / 10,
        upperBand1Sigma,
        lowerBand1Sigma,
        upperBand2Sigma,
        lowerBand2Sigma,
        upperBand3Sigma,
        lowerBand3Sigma,
        bandRange2Sigma: [lowerBand2Sigma, upperBand2Sigma],
        bandRange1Sigma: [lowerBand1Sigma, upperBand1Sigma],
        bbMiddle,
        bbUpper2,
        bbLower2,
        bbRange2: [bbLower2, bbUpper2],
        vwapDeviationRate,
      })
    }

    return result
  }, [activePattern, volumeMultiplier, volatilityMultiplier])

  // Compute 5 evenly spaced Y-axis ticks with generous top/bottom padding so nothing is clipped at the top
  const { yDomain, yTicks } = useMemo(() => {
    if (calculatedData.length === 0) {
      return {
        yDomain: [4700, 5300] as [number, number],
        yTicks: [5300, 5150, 5000, 4850, 4700],
      }
    }
    let minVal = Infinity
    let maxVal = -Infinity
    for (const d of calculatedData) {
      minVal = Math.min(minVal, d.price, d.lowerBand2Sigma)
      maxVal = Math.max(maxVal, d.price, d.upperBand2Sigma)
      if (showBollingerOverlay) {
        minVal = Math.min(minVal, d.bbLower2)
        maxVal = Math.max(maxVal, d.bbUpper2)
      }
    }
    const range = Math.max(60, maxVal - minVal)
    const bottomPad = Math.max(25, Math.round(range * 0.12))
    const topPad = Math.max(45, Math.round(range * 0.2))
    const rawMin = Math.floor((minVal - bottomPad) / 10) * 10
    const rawMax = Math.ceil((maxVal + topPad) / 10) * 10
    const step = Math.max(10, Math.ceil((rawMax - rawMin) / 4 / 10) * 10)
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
  }, [calculatedData, showBollingerOverlay])

  const maxVolume = useMemo(() => {
    let m = 1000
    for (const d of calculatedData) {
      if (d.volume > m) m = d.volume
    }
    return Math.ceil(m / 500) * 500
  }, [calculatedData])

  const signalPoints = useMemo(
    () => calculatedData.filter((d) => Boolean(d.signalLabel)),
    [calculatedData]
  )

  const totalPanRange = Math.max(1, maxPanX - minPanX)
  const thumbWidthPct = clamp((viewportWidth / canvasWidth) * 100, 20, 90)
  const thumbLeftPct = clamp(
    ((maxPanX - panX) / totalPanRange) * (100 - thumbWidthPct),
    0,
    100 - thumbWidthPct
  )

  return (
    <div className="space-y-4 pb-6">
      {/* Sub-navigation Switcher: ±2σ Band Simulator vs Real Stock VWAP Chart */}
      <div className="bg-slate-200/80 p-1 rounded-2xl grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setViewMode('simulator')}
          className={`py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
            viewMode === 'simulator'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-amber-500" />
          VWAP±2σ チャート学習
        </button>
        <button
          type="button"
          onClick={() => setViewMode('live')}
          className={`py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
            viewMode === 'live'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-emerald-600" />
          銘柄別VWAP＆ボリンジャー
        </button>
      </div>

      {viewMode === 'live' ? (
        <VwapChartCard />
      ) : (
        <div className="bg-[#1e2433] text-white rounded-3xl p-4 shadow-xl border border-slate-700/80 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm sm:text-base font-extrabold text-white">
                  日中VWAP ＆ ボリンジャーバンド（±2σ）シミュレーター
                </h2>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                チャート上をクリック（または指でタッチ）しながら左右にドラッグして自由に動かせます
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setVolumeMultiplier(2.0)
                setVolatilityMultiplier(1.0)
                setZoom(1.0)
                setPanX(0)
              }}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1 border border-slate-600 shrink-0 transition"
            >
              <RotateCcw className="w-3 h-3" />
              初期値に戻す
            </button>
          </div>

          {/* 1. パターン選択ボタン（3種類） */}
          <div className="grid grid-cols-3 gap-1.5 bg-[#0f172a] p-1.5 rounded-2xl border border-slate-700">
            {(
              [
                { key: 'pullback', color: 'bg-emerald-600' },
                { key: 'breakout', color: 'bg-blue-600' },
                { key: 'rejection', color: 'bg-rose-600' },
              ] as const
            ).map(({ key, color }) => {
              const pat = INTRADAY_PATTERNS[key]
              const isSelected = patternKey === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setPatternKey(key)
                    setPanX(0)
                  }}
                  className={`py-2 px-2 rounded-xl text-xs font-extrabold transition ${
                    isSelected
                      ? `${color} text-white shadow-sm`
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {pat.shortLabel}
                </button>
              )
            })}
          </div>

          {/* 2. インタラクティブ調整スライダー（2系統） */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0f172a] rounded-2xl p-3.5 border border-slate-700/90">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">
                  🔥 節目の大口出来高倍率
                </span>
                <span className="font-extrabold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                  {volumeMultiplier.toFixed(1)} 倍
                </span>
              </div>
              <input
                type="range"
                min={1.0}
                max={5.0}
                step={0.5}
                value={volumeMultiplier}
                onChange={(e) =>
                  setVolumeMultiplier(parseFloat(e.target.value))
                }
                className="w-full accent-amber-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                <span>1.0x (通常)</span>
                <span>3.0x (大口介入)</span>
                <span>5.0x (機関集中)</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">
                  ⚡ 日中の値動き（ボラティリティ）倍率
                </span>
                <span className="font-extrabold text-sky-300 bg-sky-500/15 px-2 py-0.5 rounded-md border border-sky-500/30">
                  {volatilityMultiplier.toFixed(1)} 倍
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={volatilityMultiplier}
                onChange={(e) =>
                  setVolatilityMultiplier(parseFloat(e.target.value))
                }
                className="w-full accent-sky-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                <span>0.5x (穏やか)</span>
                <span>1.0x (標準)</span>
                <span>2.0x (高ボラ急騰落)</span>
              </div>
            </div>
          </div>

          {/* 3. クリック＆ドラッグで左右に動かせるメイン＆サブ連動チャート */}
          <div className="bg-[#0f172a] rounded-2xl p-3 border border-slate-700/90 space-y-2.5">
            {/* Chart Top Controls: Title + Zoom + Bollinger Toggle */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-amber-300">
                  {activePattern.title}
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
                  onClick={() =>
                    setShowBollingerOverlay(!showBollingerOverlay)
                  }
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

            {/* Legend */}
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

            {/* Interactive Click-and-Drag Chart Area (Pinned Y-Axis + Draggable Plot Canvas) */}
            <div className="relative rounded-xl border border-slate-800 bg-[#0b1120] overflow-hidden">
              <div className="flex">
                {/* Pinned Left Y-Axis Column (Price + Volume) */}
                <div className="w-12 shrink-0 border-r border-slate-800/90 bg-[#0f172a]/95 z-10 select-none flex flex-col">
                  {/* Top Chart Y-Axis Ticks (matches h-68 = 272px, top:28, bottom:22) */}
                  <div className="h-[268px] pt-[28px] pb-[22px] px-1.5 flex flex-col justify-between items-end text-[10px] font-mono text-slate-400">
                    {yTicks.map((t) => (
                      <span key={t} className="leading-none">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="h-24 border-t border-slate-800/80 pt-1.5 pb-4 px-1.5 flex flex-col justify-between items-end text-[9px] font-mono text-slate-500">
                    <span>{maxVolume}</span>
                    <span>出来高</span>
                    <span>0</span>
                  </div>
                </div>

                {/* Horizontally Draggable Viewport */}
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
                          data={calculatedData}
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
                              const pt =
                                payload[0].payload as CalculatedIntradayPoint
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
                                      {pt.vwapRounded.toLocaleString()}円
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

                          {/* +2σ Band */}
                          <Line
                            type="monotone"
                            dataKey="upperBand2Sigma"
                            stroke="#fb7185"
                            strokeWidth={1.5}
                            strokeDasharray="5 4"
                            dot={false}
                            isAnimationActive={false}
                          />

                          {/* +1σ / -1σ Bands */}
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

                          {/* -2σ Band */}
                          <Line
                            type="monotone"
                            dataKey="lowerBand2Sigma"
                            stroke="#34d399"
                            strokeWidth={1.5}
                            strokeDasharray="5 4"
                            dot={false}
                            isAnimationActive={false}
                          />

                          {/* Cumulative VWAP Line */}
                          <Line
                            type="monotone"
                            dataKey="vwapRounded"
                            stroke="#f59e0b"
                            strokeWidth={3}
                            dot={false}
                            isAnimationActive={false}
                          />

                          {/* Intraday Price Line */}
                          <Line
                            type="monotone"
                            dataKey="price"
                            stroke="#38bdf8"
                            strokeWidth={2.5}
                            dot={(props) => {
                              const { cx, cy, payload } = props as {
                                cx?: number
                                cy?: number
                                payload?: CalculatedIntradayPoint
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
                                    r={3}
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
                            activeDot={{
                              r: 6,
                              fill: '#38bdf8',
                              stroke: '#fff',
                            }}
                            isAnimationActive={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Lower Synchronized Volume Bar Chart */}
                    <div className="h-24 w-full border-t border-slate-800/80 pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={calculatedData}
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
                          />
                          <YAxis domain={[0, maxVolume]} hide />
                          <Bar
                            dataKey="volume"
                            radius={[3, 3, 0, 0]}
                            isAnimationActive={false}
                          >
                            {calculatedData.map((entry) => (
                              <Cell
                                key={entry.time}
                                fill={
                                  entry.isInflection ? '#f59e0b' : '#475569'
                                }
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

          {/* 4. 実践トレードルール解説カード（3枚構成） */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="bg-emerald-950/35 border border-emerald-500/40 rounded-2xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                ① エントリー根拠
              </div>
              <p className="text-[11px] text-slate-200 leading-relaxed">
                {activePattern.entryRule}
              </p>
            </div>

            <div className="bg-amber-950/35 border border-amber-500/40 rounded-2xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-300">
                <Target className="w-4 h-4 shrink-0" />
                ② 利確ターゲット（±2σ）
              </div>
              <p className="text-[11px] text-slate-200 leading-relaxed">
                {activePattern.takeProfitRule}
              </p>
            </div>

            <div className="bg-rose-950/35 border border-rose-500/40 rounded-2xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-300">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                ③ 損切り・撤退ライン
              </div>
              <p className="text-[11px] text-slate-200 leading-relaxed">
                {activePattern.stopLossRule}
              </p>
            </div>
          </div>

          {/* 5. 機関投資家のアルゴリズムとVWAPの仕組み（教育コラム） */}
          <div className="bg-[#0f172a] rounded-2xl p-3.5 border border-slate-700/80 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-sky-300">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              なぜVWAPとボリンジャーバンド（±2σ）を重ねて見るのか？
            </div>
            <ul className="text-[11px] text-slate-300 space-y-1.5 leading-relaxed list-disc list-inside">
              <li>
                <strong className="text-white">
                  機関投資家のVWAPギャランティ取引：
                </strong>
                年金や投資信託などの大口注文は「その日のVWAPより安く買う（高く売る）」ことを目標にアルゴリズム執行されるため、株価がVWAPまで下がると機械的な買い注文が入りやすく、強い支持線（サポート）になります。
              </li>
              <li>
                <strong className="text-white">
                  ボリンジャーバンド（±1σ / ±2σ）のスクイーズ＆エクスパンション：
                </strong>
                バンド幅が狭まった状態（スクイーズ）から出来高を伴ってVWAPや+2σを上抜けると強いトレンド（バンドウォーク）が発生しやすく、逆に急騰後に+2σへ到達して失速した箇所は格好の利確目安になります。
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
