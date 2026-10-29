import React, { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Brush,
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
  ChevronLeft,
  ChevronRight,
  Hand,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { VwapChartCard } from './VwapChartCard'

// ============================================================================
// 型定義および3パターンの日中基準時系列データ（09:00〜15:30 完全収録）
// ============================================================================

export type PatternKey = 'pullback' | 'breakout' | 'rejection' | 'custom'

export interface IntradayBasePoint {
  time: string
  basePrice: number
  baseVolume: number
  isInflection?: boolean
  signalLabel?: string
  signalType?: 'entry_buy' | 'entry_sell' | 'take_profit' | 'stop_loss_ref'
}

export interface CalculatedIntradayPoint extends IntradayBasePoint {
  index: number
  price: number
  volume: number
  vwap: number
  vwapRounded: number
  sigma: number
  upperBand1Sigma: number
  lowerBand1Sigma: number
  upperBand2Sigma: number
  lowerBand2Sigma: number
  vwapDeviationRate: number
}

export const INTRADAY_PATTERNS: Record<
  Exclude<PatternKey, 'custom'>,
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
      '直近高値ブレイク後、VWAP+2σバンド付近に到達して伸びが鈍化した局面で利確',
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
      'VWAP-2σバンド付近まで急落し、売られすぎ水準に達した局面で買い戻し利確',
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

export const VwapBandSimulator: React.FC = () => {
  const [viewMode, setViewMode] = useState<'simulator' | 'live'>('simulator')
  const [patternKey, setPatternKey] = useState<PatternKey>('pullback')
  const [volumeMultiplier, setVolumeMultiplier] = useState<number>(2.0)
  const [volatilityMultiplier, setVolatilityMultiplier] = useState<number>(1.0)
  const [show1Sigma, setShow1Sigma] = useState<boolean>(true)
  const [showZoomBrush, setShowZoomBrush] = useState<boolean>(false)

  // 自分で自由に動かせるカスタムポイント配列＆選択中の時間インデックス
  const [customPoints, setCustomPoints] = useState<IntradayBasePoint[]>(() =>
    INTRADAY_PATTERNS.pullback.points.map((p) => ({ ...p }))
  )
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(5) // Default 10:15
  // 時間経過シーク（何本目までチャートを表示するか：手動で1本ずつ進められる機能）
  const [visibleCount, setVisibleCount] = useState<number>(
    INTRADAY_PATTERNS.pullback.points.length
  )

  const handleSelectPattern = (key: Exclude<PatternKey, 'custom'>) => {
    setPatternKey(key)
    const cloned = INTRADAY_PATTERNS[key].points.map((p) => ({ ...p }))
    setCustomPoints(cloned)
    setVisibleCount(cloned.length)
    setSelectedPointIndex(Math.min(5, cloned.length - 1))
  }

  const activePatternMeta =
    patternKey === 'custom'
      ? {
          title: '✍️ カスタム自由操作モード（株価・出来高を手動コントロール）',
          entryRule:
            '下の「選択中の足を動かす」スライダーやボタンで、好きな時刻の株価・出来高を動かしてVWAPの反応を実験できます',
          takeProfitRule:
            '株価を急騰させると+2σバンドが広がり、大口出来高を入れるとVWAPが株価側へ強く引き寄せられます',
          stopLossRule:
            '1本ずつ時間を進めたり戻したりして、VWAPクロスやバンドタッチの動きを自由に確認できます',
        }
      : INTRADAY_PATTERNS[patternKey]

  // ============================================================================
  // リアルタイムVWAP＆標準偏差バンド（±2σ）の算出ロジック
  // ============================================================================
  const allCalculatedData = useMemo<CalculatedIntradayPoint[]>(() => {
    const basePoints =
      patternKey === 'custom'
        ? customPoints
        : INTRADAY_PATTERNS[patternKey].points
    const adjustedPrices: number[] = []
    const adjustedVolumes: number[] = []
    const result: CalculatedIntradayPoint[] = []

    let cumPV = 0
    let cumV = 0

    for (let k = 0; k < basePoints.length; k++) {
      const pt = basePoints[k]

      // 1. 調整後価格 P_k と調整後出来高 V_k の算出（基準値 P_0 = 5000）
      const P_k =
        patternKey === 'custom'
          ? Math.round(pt.basePrice)
          : Math.round(5000 + (pt.basePrice - 5000) * volatilityMultiplier)

      const V_k =
        patternKey === 'custom'
          ? Math.round(pt.baseVolume)
          : Math.round(
              pt.baseVolume * (pt.isInflection ? volumeMultiplier : 1.0)
            )

      adjustedPrices.push(P_k)
      adjustedVolumes.push(V_k)

      // 2. 時刻 k までの累計売買代金 CumPV_k と累計出来高 CumV_k
      cumPV += P_k * V_k
      cumV += V_k

      // 3. 時刻 k の累計VWAP (VWAP_k)
      const VWAP_k = cumV > 0 ? cumPV / cumV : P_k

      // 4. 出来高加重標準偏差 sigma_k および ±2σ バンド
      let weightedSquaredSum = 0
      for (let i = 0; i <= k; i++) {
        const diff = adjustedPrices[i] - VWAP_k
        weightedSquaredSum += adjustedVolumes[i] * (diff * diff)
      }
      const variance_k = cumV > 0 ? weightedSquaredSum / cumV : 0
      const sigma_k = Math.sqrt(variance_k)

      const upperBand1Sigma = Math.round(VWAP_k + sigma_k)
      const lowerBand1Sigma = Math.round(VWAP_k - sigma_k)
      const upperBand2Sigma = Math.round(VWAP_k + 2 * sigma_k)
      const lowerBand2Sigma = Math.round(VWAP_k - 2 * sigma_k)
      const vwapDeviationRate = Number(
        (((P_k - VWAP_k) / VWAP_k) * 100).toFixed(2)
      )

      result.push({
        ...pt,
        index: k,
        price: P_k,
        volume: V_k,
        vwap: VWAP_k,
        vwapRounded: Math.round(VWAP_k),
        sigma: Math.round(sigma_k * 10) / 10,
        upperBand1Sigma,
        lowerBand1Sigma,
        upperBand2Sigma,
        lowerBand2Sigma,
        vwapDeviationRate,
      })
    }

    return result
  }, [patternKey, customPoints, volumeMultiplier, volatilityMultiplier])

  // Time seek: show up to `visibleCount` bars so user can step forward/backward in time manually
  const calculatedData = useMemo(
    () => allCalculatedData.slice(0, Math.max(2, visibleCount)),
    [allCalculatedData, visibleCount]
  )

  const activePointIndex = Math.min(
    selectedPointIndex,
    calculatedData.length - 1
  )
  const selectedPoint = calculatedData[activePointIndex] || calculatedData[0]

  // Edit a specific point's price or volume directly (switches to custom mode preserving current scaled values)
  const updateSelectedPoint = (newPrice?: number, newVol?: number) => {
    const baseList =
      patternKey === 'custom'
        ? [...customPoints]
        : allCalculatedData.map((d) => ({
            time: d.time,
            basePrice: d.price,
            baseVolume: d.volume,
            isInflection: d.isInflection,
            signalLabel: d.signalLabel,
            signalType: d.signalType,
          }))

    const target = baseList[activePointIndex]
    if (!target) return

    baseList[activePointIndex] = {
      ...target,
      basePrice:
        newPrice !== undefined ? Math.max(100, newPrice) : target.basePrice,
      baseVolume:
        newVol !== undefined ? Math.max(100, newVol) : target.baseVolume,
      isInflection:
        newVol !== undefined && newVol >= 1500 ? true : target.isInflection,
    }

    setPatternKey('custom')
    setCustomPoints(baseList)
  }

  // Append a new bar manually at the end so the user can "draw" the next candle themselves
  const handleAddNextBar = (priceDelta: number, vol = 1200) => {
    const baseList =
      patternKey === 'custom'
        ? [...customPoints]
        : allCalculatedData.map((d) => ({
            time: d.time,
            basePrice: d.price,
            baseVolume: d.volume,
            isInflection: d.isInflection,
            signalLabel: d.signalLabel,
            signalType: d.signalType,
          }))

    const last = baseList[baseList.length - 1]
    const nextPrice = Math.max(100, (last?.basePrice || 5000) + priceDelta)
    const nextNum = baseList.length + 1
    const newPt: IntradayBasePoint = {
      time: `追加${nextNum}`,
      basePrice: nextPrice,
      baseVolume: vol,
      isInflection: vol >= 2000,
    }
    const updated = [...baseList, newPt]
    setPatternKey('custom')
    setCustomPoints(updated)
    setVisibleCount(updated.length)
    setSelectedPointIndex(updated.length - 1)
  }

  const yDomain = useMemo(() => {
    if (calculatedData.length === 0) return [4700, 5300]
    let minVal = Infinity
    let maxVal = -Infinity
    for (const d of calculatedData) {
      minVal = Math.min(minVal, d.price, d.lowerBand2Sigma)
      maxVal = Math.max(maxVal, d.price, d.upperBand2Sigma)
    }
    const pad = Math.max(20, Math.round((maxVal - minVal) * 0.1))
    return [Math.floor(minVal - pad), Math.ceil(maxVal + pad)]
  }, [calculatedData])

  const signalPoints = useMemo(
    () => calculatedData.filter((d) => Boolean(d.signalLabel)),
    [calculatedData]
  )

  return (
    <div className="space-y-4 pb-6">
      {/* Sub-navigation Switcher: ±2σ Band Simulator vs Real Stock Static VWAP Chart */}
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
          VWAP±2σ 手動シミュレーター
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
          銘柄別VWAPチャート
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
                  日中VWAP ＆ 標準偏差（±2σ）バンド シミュレーター
                </h2>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                自分の手で時間を進めたり、株価・出来高を動かしてVWAPの変化を確認できます
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setVolumeMultiplier(2.0)
                setVolatilityMultiplier(1.0)
                handleSelectPattern('pullback')
              }}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1 border border-slate-600 shrink-0 transition"
            >
              <RotateCcw className="w-3 h-3" />
              リセット
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
                  onClick={() => handleSelectPattern(key)}
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

          {/* 2. 自分の手でチャートを動かすコントロールパネル（時間コマ送り ＆ 選択地点の株価・出来高編集） */}
          <div className="bg-[#0f172a] rounded-2xl p-3.5 border border-slate-700/90 space-y-3">
            {/* (A) 時間シークバー（09:00〜15:30 を自分の指で進める・戻す） */}
            <div className="space-y-1.5 pb-3 border-b border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-amber-300 flex items-center gap-1">
                  ⏱️ チャートの時間を動かす（コマ送り・巻き戻し）
                </span>
                <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                  表示: 09:00 〜 {calculatedData[calculatedData.length - 1]?.time} (
                  {calculatedData.length}/{allCalculatedData.length}本)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={visibleCount <= 2}
                  onClick={() => {
                    const next = Math.max(2, visibleCount - 1)
                    setVisibleCount(next)
                    setSelectedPointIndex(next - 1)
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-xs font-bold flex items-center gap-0.5 border border-slate-600 shrink-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  1本戻す
                </button>

                <input
                  type="range"
                  min={2}
                  max={allCalculatedData.length}
                  step={1}
                  value={visibleCount}
                  onChange={(e) => {
                    const next = parseInt(e.target.value, 10)
                    setVisibleCount(next)
                    setSelectedPointIndex(next - 1)
                  }}
                  className="flex-1 accent-amber-400 cursor-pointer"
                />

                <button
                  type="button"
                  disabled={visibleCount >= allCalculatedData.length}
                  onClick={() => {
                    const next = Math.min(
                      allCalculatedData.length,
                      visibleCount + 1
                    )
                    setVisibleCount(next)
                    setSelectedPointIndex(next - 1)
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-35 text-xs font-extrabold flex items-center gap-0.5 text-white shrink-0"
                >
                  1本進める
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* (B) 選択中の地点の「株価」と「出来高」を自分で直接動かすコントロール */}
            {selectedPoint && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-xs font-extrabold text-sky-300 flex items-center gap-1">
                    <Hand className="w-3.5 h-3.5" />
                    グラフ上の点をタップ（現在選択中: {selectedPoint.time}）して株価を動かす
                  </span>
                  <span className="text-[11px] text-slate-400">
                    VWAP: <strong className="text-amber-300">{selectedPoint.vwapRounded}円</strong> / 乖離:{' '}
                    <strong
                      className={
                        selectedPoint.vwapDeviationRate >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }
                    >
                      {selectedPoint.vwapDeviationRate >= 0 ? '+' : ''}
                      {selectedPoint.vwapDeviationRate}%
                    </strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Direct Price Control for Selected Point */}
                  <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-bold">
                        {selectedPoint.time} の株価
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedPoint(selectedPoint.price - 20)
                          }
                          className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-bold active:scale-95"
                        >
                          -20円
                        </button>
                        <span className="font-mono font-extrabold text-[#38bdf8] px-1">
                          {selectedPoint.price.toLocaleString()}円
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedPoint(selectedPoint.price + 20)
                          }
                          className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold active:scale-95"
                        >
                          +20円
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={4600}
                      max={5400}
                      step={5}
                      value={selectedPoint.price}
                      onChange={(e) =>
                        updateSelectedPoint(parseInt(e.target.value, 10))
                      }
                      className="w-full accent-[#38bdf8] cursor-pointer"
                    />
                  </div>

                  {/* Direct Volume Control for Selected Point */}
                  <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-bold">
                        {selectedPoint.time} の出来高
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedPoint(
                              undefined,
                              Math.max(200, selectedPoint.volume - 500)
                            )
                          }
                          className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-600 text-[11px] font-bold active:scale-95"
                        >
                          -500
                        </button>
                        <span className="font-mono font-extrabold text-amber-300 px-1">
                          {selectedPoint.volume.toLocaleString()}株
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedPoint(
                              undefined,
                              selectedPoint.volume + 1000
                            )
                          }
                          className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold active:scale-95"
                        >
                          +大口
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={200}
                      max={8000}
                      step={100}
                      value={selectedPoint.volume}
                      onChange={(e) =>
                        updateSelectedPoint(
                          undefined,
                          parseInt(e.target.value, 10)
                        )
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Add Next Custom Bar Buttons ("自分で右側にチャートを描き足す") */}
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 font-bold">
                    ✍️ 次の足を自分で追加：
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleAddNextBar(35, 1800)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/50 text-[11px] font-extrabold flex items-center gap-1 active:scale-95 transition"
                    >
                      <TrendingUp className="w-3 h-3" />
                      +上昇足を追加
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddNextBar(0, 800)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 text-[11px] font-bold flex items-center gap-1 active:scale-95 transition"
                    >
                      <Plus className="w-3 h-3" />
                      横ばい足
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddNextBar(-35, 1800)}
                      className="px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 border border-rose-500/50 text-[11px] font-extrabold flex items-center gap-1 active:scale-95 transition"
                    >
                      <TrendingDown className="w-3 h-3" />
                      -下落足を追加
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 全体倍率スライダー（大口出来高の強さ & ボラティリティ） */}
          {patternKey !== 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-[#0f172a] rounded-2xl p-3 border border-slate-700/90">
              <div className="space-y-1">
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
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">
                    ⚡ 値動きの荒さ（ボラ倍率）
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
              </div>
            </div>
          )}

          {/* 3. Main Interactive Chart: Price + VWAP + ±1σ / ±2σ Bands */}
          <div className="bg-[#0f172a] rounded-2xl p-3 border border-slate-700/90 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-extrabold text-amber-300">
                {activePatternMeta.title}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowZoomBrush(!showZoomBrush)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                    showZoomBrush
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  区間ズームバー {showZoomBrush ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setShow1Sigma(!show1Sigma)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                    show1Sigma
                      ? 'bg-slate-700 text-slate-200 border-slate-500'
                      : 'bg-slate-900 text-slate-500 border-slate-800'
                  }`}
                >
                  ±1σ {show1Sigma ? '表示' : '非表示'}
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-300">
              <span className="flex items-center gap-1 text-[#38bdf8]">
                <span className="w-3 h-0.5 bg-[#38bdf8] inline-block" />
                株価（タップで選択可）
              </span>
              <span className="flex items-center gap-1 text-[#f59e0b]">
                <span className="w-3 h-0.5 bg-[#f59e0b] inline-block" />
                累計VWAP
              </span>
              <span className="flex items-center gap-1 text-purple-400">
                <span className="w-3 h-0.5 border-b border-dashed border-purple-400 inline-block" />
                +2σ (利確目安)
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-3 h-0.5 border-b border-dashed border-emerald-400 inline-block" />
                -2σ (買戻目安)
              </span>
            </div>

            {/* Price & VWAP Band Chart */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={calculatedData}
                  margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
                  onClick={(state) => {
                    if (
                      state &&
                      typeof state.activeTooltipIndex === 'number' &&
                      state.activeTooltipIndex >= 0
                    ) {
                      setSelectedPointIndex(state.activeTooltipIndex)
                    }
                  }}
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
                  />
                  <YAxis
                    domain={yDomain}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0].payload as CalculatedIntradayPoint
                      return (
                        <div className="bg-slate-900/95 border border-slate-600 rounded-2xl p-3 text-xs shadow-2xl space-y-1">
                          <div className="font-extrabold text-white border-b border-slate-700 pb-1 flex items-center justify-between gap-3">
                            <span>⏰ {d.time}（タップでこの足を編集）</span>
                            {d.signalLabel && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                                {d.signalLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-[#38bdf8] font-bold">
                              株価 (P_k)：
                            </span>
                            <span className="font-extrabold text-white">
                              {d.price.toLocaleString()}円 (
                              {d.vwapDeviationRate >= 0 ? '+' : ''}
                              {d.vwapDeviationRate}%)
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-[#f59e0b] font-bold">
                              累計VWAP：
                            </span>
                            <span className="font-extrabold text-[#f59e0b]">
                              {d.vwapRounded.toLocaleString()}円
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-purple-300">
                              VWAP +2σ / -2σ：
                            </span>
                            <span className="font-mono font-bold text-slate-200">
                              {d.upperBand2Sigma.toLocaleString()}円 /{' '}
                              {d.lowerBand2Sigma.toLocaleString()}円
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">
                              出来高 (V_k)：
                            </span>
                            <span className="font-mono font-bold text-amber-200">
                              {d.volume.toLocaleString()}株
                              {d.isInflection ? ' (🔥節目大口)' : ''}
                            </span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  {selectedPoint && (
                    <ReferenceLine
                      x={selectedPoint.time}
                      stroke="#38bdf8"
                      strokeDasharray="3 3"
                      strokeWidth={1.5}
                    />
                  )}
                  <ReferenceLine
                    y={5000}
                    stroke="#475569"
                    strokeDasharray="2 2"
                  />

                  {/* +2σ / -2σ Bands */}
                  <Line
                    type="monotone"
                    dataKey="upperBand2Sigma"
                    stroke="#c084fc"
                    strokeWidth={1.6}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="lowerBand2Sigma"
                    stroke="#34d399"
                    strokeWidth={1.6}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />

                  {/* Optional +1σ / -1σ Bands */}
                  {show1Sigma && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="upperBand1Sigma"
                        stroke="#94a3b8"
                        strokeWidth={1}
                        strokeDasharray="2 3"
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="lowerBand1Sigma"
                        stroke="#94a3b8"
                        strokeWidth={1}
                        strokeDasharray="2 3"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </>
                  )}

                  {/* Cumulative VWAP Line */}
                  <Line
                    type="monotone"
                    dataKey="vwapRounded"
                    stroke="#f59e0b"
                    strokeWidth={2.8}
                    dot={false}
                    isAnimationActive={false}
                  />

                  {/* Intraday Stock Price Line with Interactive Dots */}
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    isAnimationActive={false}
                    dot={(props) => {
                      const { cx, cy, payload } = props as {
                        cx?: number
                        cy?: number
                        payload?: CalculatedIntradayPoint
                      }
                      if (!cx || !cy || !payload) return <g />
                      const isSelectedDot = payload.index === activePointIndex
                      if (!payload.signalType && !isSelectedDot) {
                        return (
                          <circle
                            key={payload.time}
                            cx={cx}
                            cy={cy}
                            r={3}
                            fill="#38bdf8"
                            fillOpacity={0.5}
                          />
                        )
                      }
                      const color = isSelectedDot
                        ? '#38bdf8'
                        : payload.signalType === 'entry_buy'
                        ? '#10b981'
                        : payload.signalType === 'entry_sell'
                        ? '#f43f5e'
                        : '#f59e0b'
                      return (
                        <circle
                          key={payload.time}
                          cx={cx}
                          cy={cy}
                          r={isSelectedDot ? 7 : 5.5}
                          fill={color}
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      )
                    }}
                  />

                  {showZoomBrush && (
                    <Brush
                      dataKey="time"
                      height={24}
                      stroke="#38bdf8"
                      fill="#0f172a"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Synchronized Volume Bar Chart */}
            <div className="pt-1 border-t border-slate-800">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span>📊 時間帯別 出来高推移（棒をタップして選択可）</span>
                <span className="text-amber-400 font-bold">
                  ■オレンジ＝大口出来高
                </span>
              </div>
              <div className="h-20 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={calculatedData}
                    margin={{ top: 2, right: 8, left: -12, bottom: 0 }}
                    onClick={(state) => {
                      if (
                        state &&
                        typeof state.activeTooltipIndex === 'number' &&
                        state.activeTooltipIndex >= 0
                      ) {
                        setSelectedPointIndex(state.activeTooltipIndex)
                      }
                    }}
                  >
                    <XAxis dataKey="time" hide />
                    <YAxis
                      tick={{ fontSize: 9, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Bar
                      dataKey="volume"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    >
                      {calculatedData.map((entry) => (
                        <Cell
                          key={entry.time}
                          fill={
                            entry.index === activePointIndex
                              ? '#38bdf8'
                              : entry.isInflection
                              ? '#f59e0b'
                              : '#475569'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Signal Timeline Badges */}
          {signalPoints.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-extrabold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                チャート上の売買シグナル地点（タップでその時刻を選択）
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {signalPoints.map((sp) => (
                  <div
                    key={sp.time}
                    onClick={() => setSelectedPointIndex(sp.index)}
                    className={`bg-[#0f172a] border rounded-xl px-3 py-2 flex items-center justify-between text-xs cursor-pointer transition ${
                      sp.index === activePointIndex
                        ? 'border-sky-400 ring-1 ring-sky-400/40'
                        : 'border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-400">
                        {sp.time}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          sp.signalType === 'entry_buy'
                            ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                            : sp.signalType === 'entry_sell'
                            ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                            : 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {sp.signalLabel}
                      </span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-extrabold text-white">
                        株価 {sp.price.toLocaleString()}円
                      </span>
                      <span className="text-[11px] text-amber-300 ml-2">
                        (VWAP {sp.vwapRounded.toLocaleString()}円)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Entry / Take Profit / Stop Loss Rule Cards */}
          <div className="bg-[#0f172a] rounded-2xl p-3.5 border border-slate-700 space-y-2.5 text-xs">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-emerald-300">
                  エントリー条件：
                </span>
                <span className="text-slate-200">
                  {activePatternMeta.entryRule}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Target className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-amber-300">
                  利確ルール（±2σ活用）：
                </span>
                <span className="text-slate-200">
                  {activePatternMeta.takeProfitRule}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-rose-300">
                  損切りルール：
                </span>
                <span className="text-slate-200">
                  {activePatternMeta.stopLossRule}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
