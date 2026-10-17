import React, { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Award, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { useStockStore } from '../store/useStockStore'
import { NumberControl } from './NumberControl'
import { formatManYen } from '../utils/format'

const TAX_RATE = 0.20315

interface YearlyDataPoint {
  year: number
  label: string
  principalMan: number
  profitMan: number
  totalMan: number
}

export const CompoundSimulator: React.FC = () => {
  const { compound, updateCompound } = useStockStore()
  const { initialManYen, monthlyManYen, annualRate, years, isNisa } = compound

  const simulation = useMemo(() => {
    const monthlyRate = annualRate / 100 / 12
    const data: YearlyDataPoint[] = []

    let currentBalance = initialManYen * 10000
    let totalPrincipal = initialManYen * 10000
    const monthlyContribution = monthlyManYen * 10000
    let nisaCapReachedYear: number | null = null
    let profitExceedsPrincipalYear: number | null = null

    for (let y = 1; y <= years; y++) {
      for (let m = 1; m <= 12; m++) {
        currentBalance = currentBalance * (1 + monthlyRate) + monthlyContribution
        totalPrincipal += monthlyContribution
      }

      if (nisaCapReachedYear === null && totalPrincipal >= 18000000) {
        nisaCapReachedYear = y
      }

      const grossProfit = Math.max(0, currentBalance - totalPrincipal)
      const netProfit = isNisa ? grossProfit : grossProfit * (1 - TAX_RATE)
      const effectiveTotal = totalPrincipal + netProfit

      if (
        profitExceedsPrincipalYear === null &&
        netProfit >= totalPrincipal &&
        totalPrincipal > 0
      ) {
        profitExceedsPrincipalYear = y
      }

      data.push({
        year: y,
        label: `${y}年`,
        principalMan: Math.round(totalPrincipal / 10000),
        profitMan: Math.round(netProfit / 10000),
        totalMan: Math.round(effectiveTotal / 10000),
      })
    }

    const finalGrossProfit = Math.max(0, currentBalance - totalPrincipal)
    const taxSavedYen = Math.round(finalGrossProfit * TAX_RATE)
    const finalActiveProfit = isNisa
      ? finalGrossProfit
      : finalGrossProfit - taxSavedYen
    const finalTotalYen = totalPrincipal + finalActiveProfit
    const multiple =
      totalPrincipal > 0 ? finalTotalYen / totalPrincipal : 1

    return {
      data,
      totalPrincipalYen: totalPrincipal,
      finalGrossProfitYen: finalGrossProfit,
      finalActiveProfitYen: finalActiveProfit,
      finalTotalYen,
      taxSavedYen,
      multiple,
      nisaCapReachedYear,
      profitExceedsPrincipalYear,
    }
  }, [initialManYen, monthlyManYen, annualRate, years, isNisa])

  return (
    <div className="space-y-4 pb-6">
      {/* Hero Summary Card */}
      <div className="bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-700 text-white rounded-3xl p-5 shadow-lg shadow-emerald-900/10 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10 pointer-events-none" />

        {/* Account Type Toggle */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-bold text-emerald-100 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-amber-300" />
            {years}年後の予想資産額
          </span>

          <div className="bg-black/25 p-1 rounded-full flex items-center text-xs font-bold">
            <button
              type="button"
              onClick={() => updateCompound({ isNisa: true })}
              className={`px-3 py-1 rounded-full transition ${
                isNisa
                  ? 'bg-amber-400 text-slate-900 shadow-xs'
                  : 'text-emerald-100 hover:text-white'
              }`}
            >
              新NISA (非課税)
            </button>
            <button
              type="button"
              onClick={() => updateCompound({ isNisa: false })}
              className={`px-3 py-1 rounded-full transition ${
                !isNisa
                  ? 'bg-white text-emerald-950 shadow-xs'
                  : 'text-emerald-100 hover:text-white'
              }`}
            >
              特定口座 (税引後)
            </button>
          </div>
        </div>

        {/* Main Asset Total */}
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <div className="text-4xl font-extrabold tracking-tight">
              {formatManYen(simulation.finalTotalYen)}
            </div>
            <div className="text-xs text-emerald-100 mt-1">
              投資元本 {formatManYen(simulation.totalPrincipalYen)} ＋ 運用益{' '}
              <span className="font-bold text-amber-200">
                +{formatManYen(simulation.finalActiveProfitYen)}
              </span>
            </div>
          </div>

          <div className="bg-white/15 backdrop-blur-xs border border-white/20 rounded-2xl px-3.5 py-2 text-right">
            <div className="text-[11px] text-emerald-100">元本からの倍率</div>
            <div className="text-lg font-extrabold text-amber-300">
              {simulation.multiple.toFixed(2)}倍
            </div>
          </div>
        </div>

        {/* NISA Tax Saved Banner */}
        <div className="mt-3.5 bg-black/20 rounded-2xl p-3 border border-white/10 text-xs flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-emerald-50">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            新NISAなら運用益にかかる税金が0円！
          </span>
          <span className="font-extrabold text-amber-300 shrink-0">
            +{formatManYen(simulation.taxSavedYen)} おトク
          </span>
        </div>
      </div>

      {/* Interactive Stacked Bar Chart Card */}
      <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              資産推移グラフ（元本と運用益）
            </h2>
            <p className="text-[11px] text-slate-400">
              スライダーを動かすとリアルタイムに変化します
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="flex items-center gap-1 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 inline-block" />
              元本
            </span>
            <span className="flex items-center gap-1 text-emerald-600">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400 inline-block" />
              運用益
            </span>
          </div>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={simulation.data}
              margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}万`}
              />
              <Tooltip
                cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const d = payload[0].payload as YearlyDataPoint
                  return (
                    <div className="bg-slate-900/95 text-white text-xs rounded-2xl p-3 shadow-xl border border-slate-700 space-y-1">
                      <div className="font-bold text-amber-300 border-b border-slate-700 pb-1 mb-1">
                        {d.year}年目の資産合計：{d.totalMan.toLocaleString()}万円
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-emerald-300">運用収益：</span>
                        <span className="font-bold">+{d.profitMan.toLocaleString()}万円</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-indigo-300">投資元本：</span>
                        <span className="font-bold">{d.principalMan.toLocaleString()}万円</span>
                      </div>
                    </div>
                  )
                }}
              />
              <Bar
                dataKey="principalMan"
                stackId="a"
                fill="#6366f1"
                radius={[0, 0, 4, 4]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="profitMan"
                stackId="a"
                fill="#10b981"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Milestones Callouts */}
        <div className="mt-3 grid grid-cols-1 gap-2">
          {simulation.profitExceedsPrincipalYear && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-3 py-2 text-xs text-emerald-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>{simulation.profitExceedsPrincipalYear}年目</strong>に「複利の運用益」が「投資元本」を上回ります（資産2倍突破！）
              </span>
            </div>
          )}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs text-slate-600 flex items-center justify-between">
            <span>新NISA 生涯投資枠（1,800万円）に対する元本比率</span>
            <span className="font-extrabold text-slate-800">
              {Math.round((simulation.totalPrincipalYen / 18000000) * 100)}%
              {simulation.nisaCapReachedYear
                ? `（${simulation.nisaCapReachedYear}年目に1,800万円到達）`
                : '（枠内で収まります）'}
            </span>
          </div>
        </div>
      </div>

      {/* Sliders Section */}
      <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-800">
          積立条件のシミュレーション設定
        </h2>

        <NumberControl
          label="毎月の積立額"
          subLabel={`（年間 ${monthlyManYen * 12}万円）`}
          value={monthlyManYen}
          onChange={(val) => updateCompound({ monthlyManYen: val })}
          min={0}
          max={30}
          step={1}
          unit="万円/月"
          accentColor="emerald"
          allowDecimals
          presets={[
            { label: '1万円', value: 1 },
            { label: '3万円', value: 3 },
            { label: '5万円', value: 5 },
            { label: '10万円(満額目安)', value: 10 },
          ]}
        />

        <NumberControl
          label="想定利回り（年率）"
          value={annualRate}
          onChange={(val) => updateCompound({ annualRate: val })}
          min={0.5}
          max={15}
          step={0.5}
          unit="%"
          accentColor="emerald"
          allowDecimals
          presets={[
            { label: '3% (堅実・高配当)', value: 3.0 },
            { label: '5% (オルカン目安)', value: 5.0 },
            { label: '7% (S&P500目安)', value: 7.0 },
            { label: '10% (積極運用)', value: 10.0 },
          ]}
        />

        <NumberControl
          label="積立・運用する期間"
          value={years}
          onChange={(val) => updateCompound({ years: Math.max(1, val) })}
          min={1}
          max={40}
          step={1}
          unit="年間"
          accentColor="indigo"
          presets={[
            { label: '5年', value: 5 },
            { label: '10年', value: 10 },
            { label: '15年', value: 15 },
            { label: '20年', value: 20 },
            { label: '30年', value: 30 },
          ]}
        />

        <NumberControl
          label="初期投資額（最初のまとまった資金）"
          value={initialManYen}
          onChange={(val) => updateCompound({ initialManYen: val })}
          min={0}
          max={1000}
          step={10}
          unit="万円"
          accentColor="amber"
          presets={[
            { label: '0円から', value: 0 },
            { label: '10万円', value: 10 },
            { label: '50万円', value: 50 },
            { label: '100万円', value: 100 },
            { label: '300万円', value: 300 },
          ]}
        />
      </div>
    </div>
  )
}
