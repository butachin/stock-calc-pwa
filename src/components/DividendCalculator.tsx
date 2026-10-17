import React from 'react'
import {
  Gift,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  Target,
  BookmarkPlus,
} from 'lucide-react'
import { useStockStore } from '../store/useStockStore'
import { NumberControl } from './NumberControl'
import { formatManYen, formatNumber, formatYen } from '../utils/format'

const TAX_RATE = 0.20315 // 所得税15.315% + 住民税5%

export const DividendCalculator: React.FC = () => {
  const { dividend, updateDividend, addSavedStock } = useStockStore()

  const {
    stockName,
    stockPrice,
    dividendPerShare,
    shares,
    perkValue,
    isNisa,
    targetMonthlyDividend,
  } = dividend

  const totalInvestment = stockPrice * shares
  const annualDividendGross = dividendPerShare * shares
  const annualTaxAmount = Math.round(annualDividendGross * TAX_RATE)
  const annualDividendNetTaxable = annualDividendGross - annualTaxAmount

  const activeAnnualDividend = isNisa
    ? annualDividendGross
    : annualDividendNetTaxable

  const totalAnnualBenefit = activeAnnualDividend + perkValue
  const monthlyEquivalent = Math.round(totalAnnualBenefit / 12)

  // Yields (%)
  const dividendYieldGross =
    stockPrice > 0 ? (dividendPerShare / stockPrice) * 100 : 0
  const dividendYieldActive =
    totalInvestment > 0 ? (activeAnnualDividend / totalInvestment) * 100 : 0
  const perkYield =
    totalInvestment > 0 ? (perkValue / totalInvestment) * 100 : 0
  const totalYieldActive = dividendYieldActive + perkYield

  // Target Dividend Reverse Calculation
  const targetAnnualDividend = targetMonthlyDividend * 12
  // Required gross dividend for target net dividend
  const requiredGrossForTaxable = targetAnnualDividend / (1 - TAX_RATE)

  const requiredCapitalNisa =
    dividendYieldGross > 0
      ? Math.round(targetAnnualDividend / (dividendYieldGross / 100))
      : 0
  const requiredCapitalTaxable =
    dividendYieldGross > 0
      ? Math.round(requiredGrossForTaxable / (dividendYieldGross / 100))
      : 0

  const requiredSharesNisa =
    dividendPerShare > 0 ? Math.ceil(targetAnnualDividend / dividendPerShare) : 0

  const capitalSavedByNisa = Math.max(
    0,
    requiredCapitalTaxable - requiredCapitalNisa
  )

  const handleSaveStock = () => {
    addSavedStock({
      code: '',
      name:
        stockName.trim() ||
        `配当試算（利回り${dividendYieldGross.toFixed(2)}%）`,
      currentPrice: stockPrice,
      avgBuyPrice: stockPrice,
      shares,
      dividendPerShare,
      perkValue,
      tag: 'NISA候補',
      memo: `表面利回り${dividendYieldGross.toFixed(2)}% / 総合利回り${totalYieldActive.toFixed(2)}%（年間配当${formatYen(activeAnnualDividend)}＋優待${formatYen(perkValue)}）`,
    })
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Hero Summary Card */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 text-white rounded-3xl p-5 shadow-lg shadow-indigo-900/10 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10 pointer-events-none" />

        {/* Account Type Toggle (NISA vs Taxable) */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="text-xs font-bold text-indigo-100 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-amber-300" />
            口座タイプ切り替え
          </span>

          <div className="bg-black/25 p-1 rounded-full flex items-center text-xs font-bold">
            <button
              type="button"
              onClick={() => updateDividend({ isNisa: true })}
              className={`px-3 py-1 rounded-full transition ${
                isNisa
                  ? 'bg-amber-400 text-slate-900 shadow-xs'
                  : 'text-indigo-100 hover:text-white'
              }`}
            >
              新NISA (非課税)
            </button>
            <button
              type="button"
              onClick={() => updateDividend({ isNisa: false })}
              className={`px-3 py-1 rounded-full transition ${
                !isNisa
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-indigo-100 hover:text-white'
              }`}
            >
              特定口座 (約20%税)
            </button>
          </div>
        </div>

        {/* Yield & Annual Cashflow Display */}
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <div className="text-xs text-indigo-100 font-medium">
              {perkValue > 0 ? '配当＋優待 総合利回り' : '年間配当利回り（手取り）'}
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-4xl font-extrabold tracking-tight text-amber-300">
                {totalYieldActive.toFixed(2)}
              </span>
              <span className="text-lg font-bold text-amber-200">%</span>
            </div>
            <div className="text-[11px] text-indigo-100 mt-1">
              配当のみ: {dividendYieldActive.toFixed(2)}%
              {perkValue > 0 && ` ＋ 優待: ${perkYield.toFixed(2)}%`}
            </div>
          </div>

          <div className="bg-white/15 backdrop-blur-xs border border-white/20 rounded-2xl p-3 text-right">
            <div className="text-[11px] text-indigo-100">
              年間手取り（配当＋優待）
            </div>
            <div className="text-xl font-extrabold text-white mt-0.5">
              {formatYen(totalAnnualBenefit)}
              <span className="text-xs font-normal text-indigo-100">/年</span>
            </div>
            <div className="text-[11px] text-amber-200 font-bold mt-0.5">
              月あたり 約{formatYen(monthlyEquivalent)}
            </div>
          </div>
        </div>

        {/* NISA Tax Comparison Callout */}
        <div className="mt-4 bg-black/20 rounded-2xl p-3 border border-white/10 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-amber-300">
              <Sparkles className="w-4 h-4 shrink-0" />
              新NISAの非課税メリット（約20.3%節税）
            </span>
            <span className="font-extrabold text-white">
              毎年 +{formatYen(annualTaxAmount)} おトク
            </span>
          </div>
          <div className="flex items-center justify-between text-indigo-100 mt-1.5 pt-1.5 border-t border-white/10">
            <span>特定口座の手取り: {formatYen(annualDividendNetTaxable)}/年</span>
            <span className="font-bold text-amber-200">
              10年で +{formatYen(annualTaxAmount * 10)} 差がつく！
            </span>
          </div>
        </div>

        {/* Bottom 3 Stats */}
        <div className="grid grid-cols-3 gap-2 mt-3.5 text-center">
          <div className="bg-white/10 rounded-xl p-2">
            <div className="text-[11px] text-indigo-100">必要投資額</div>
            <div className="text-sm font-bold mt-0.5">
              {formatYen(totalInvestment)}
            </div>
          </div>
          <div className="bg-white/10 rounded-xl p-2">
            <div className="text-[11px] text-indigo-100">年間配当(手取り)</div>
            <div className="text-sm font-bold mt-0.5">
              {formatYen(activeAnnualDividend)}
            </div>
          </div>
          <div className="bg-white/10 rounded-xl p-2">
            <div className="text-[11px] text-indigo-100">株主優待換算</div>
            <div className="text-sm font-bold mt-0.5 text-amber-200">
              {formatYen(perkValue)}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Save to Notebook Bar */}
      <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-slate-200/80 flex items-center gap-2">
        <input
          type="text"
          value={stockName}
          onChange={(e) => updateDividend({ stockName: e.target.value })}
          placeholder="銘柄名メモ（例：NTT、イオン、高配当株など）"
          className="flex-1 min-w-[160px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="button"
          onClick={handleSaveStock}
          className="px-3.5 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1 shrink-0 active:scale-95 transition"
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
          ノート登録
        </button>
      </div>

      {/* Section 1: Stock & Dividend Inputs */}
      <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-indigo-600" />
          株価・配当金・株主優待の入力
        </h2>

        <NumberControl
          label="現在の株価"
          subLabel="（1株あたり）"
          value={stockPrice}
          onChange={(val) => updateDividend({ stockPrice: val })}
          min={50}
          max={10000}
          step={50}
          unit="円"
          accentColor="indigo"
          presets={[
            { label: '150円(NTT等)', value: 150 },
            { label: '1,500円', value: 1500 },
            { label: '3,000円', value: 3000 },
            { label: '5,000円', value: 5000 },
          ]}
        />

        <NumberControl
          label="1株あたり年間配当金"
          value={dividendPerShare}
          onChange={(val) => updateDividend({ dividendPerShare: val })}
          min={0}
          max={500}
          step={5}
          unit="円"
          accentColor="indigo"
          allowDecimals
          presets={[
            {
              label: `利回り3% (${Math.round(stockPrice * 0.03)}円)`,
              value: Math.round(stockPrice * 0.03),
            },
            {
              label: `利回り4% (${Math.round(stockPrice * 0.04)}円)`,
              value: Math.round(stockPrice * 0.04),
            },
            {
              label: `利回り5% (${Math.round(stockPrice * 0.05)}円)`,
              value: Math.round(stockPrice * 0.05),
            },
          ]}
        />

        <NumberControl
          label="保有する株数"
          value={shares}
          onChange={(val) => updateDividend({ shares: val })}
          min={1}
          max={5000}
          step={100}
          unit="株"
          accentColor="indigo"
          presets={[
            { label: '100株', value: 100 },
            { label: '200株', value: 200 },
            { label: '500株', value: 500 },
            { label: '1,000株', value: 1000 },
          ]}
        />

        <NumberControl
          label="株主優待の年間価値"
          subLabel="（QUOカード・お買物券など）"
          value={perkValue}
          onChange={(val) => updateDividend({ perkValue: val })}
          min={0}
          max={20000}
          step={500}
          unit="円"
          accentColor="amber"
          presets={[
            { label: '優待なし(0円)', value: 0 },
            { label: '1,000円相当', value: 1000 },
            { label: '3,000円相当', value: 3000 },
            { label: '5,000円相当', value: 5000 },
            { label: '10,000円相当', value: 10000 },
          ]}
        />
      </div>

      {/* Section 2: Target Dividend Reverse Calculator */}
      <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 space-y-3.5">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600" />
            目標の配当金から「必要資金」を逆算
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            今の配当利回り（表面 {dividendYieldGross.toFixed(2)}%）で目標額をもらうには？
          </p>
        </div>

        <NumberControl
          label="目標の毎月配当金"
          subLabel={`（年間 ${formatManYen(targetAnnualDividend)}）`}
          value={targetMonthlyDividend}
          onChange={(val) => updateDividend({ targetMonthlyDividend: val })}
          min={1000}
          max={100000}
          step={1000}
          unit="円/月"
          accentColor="emerald"
          presets={[
            { label: '月3,000円', value: 3000 },
            { label: '月5,000円', value: 5000 },
            { label: '月1万円(年12万)', value: 10000 },
            { label: '月3万円(年36万)', value: 30000 },
            { label: '月5万円(年60万)', value: 50000 },
          ]}
        />

        {dividendYieldGross > 0 ? (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">
                    新NISAなら
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                    非課税
                  </span>
                </div>
                <div className="text-xl font-extrabold text-emerald-700 mt-1">
                  {formatManYen(requiredCapitalNisa)}
                </div>
                <div className="text-[11px] text-emerald-800 mt-0.5">
                  必要株数: 約 {formatNumber(requiredSharesNisa)}株
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                <div className="text-xs font-bold text-slate-600">
                  特定口座だと
                </div>
                <div className="text-xl font-extrabold text-slate-700 mt-1">
                  {formatManYen(requiredCapitalTaxable)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  税金分だけ多く元本が必要
                </div>
              </div>
            </div>

            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3 flex items-center justify-between text-xs">
              <span className="font-bold text-amber-900 flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-amber-600 shrink-0" />
                新NISAなら達成に必要な元本が
              </span>
              <span className="text-sm font-extrabold text-amber-700">
                {formatManYen(capitalSavedByNisa)} 少なくて済む！
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-center text-slate-400 py-4 bg-slate-50 rounded-2xl">
            1株あたり配当金を1円以上に設定すると必要資金が計算されます
          </div>
        )}
      </div>
    </div>
  )
}
