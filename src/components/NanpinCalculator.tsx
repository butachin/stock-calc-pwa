import React, { useState } from 'react'
import {
  ArrowDownRight,
  BookmarkPlus,
  History,
  RotateCcw,
  Sparkles,
  Trash2,
  TrendingUp,
  Info,
} from 'lucide-react'
import { useStockStore } from '../store/useStockStore'
import { NumberControl } from './NumberControl'
import { formatNumber, formatSignedYen, formatYen } from '../utils/format'

export const NanpinCalculator: React.FC = () => {
  const {
    nanpin,
    nanpinHistory,
    updateNanpin,
    resetNanpin,
    saveNanpinHistory,
    deleteNanpinHistory,
    addSavedStock,
  } = useStockStore()

  const [showTargetSim, setShowTargetSim] = useState(true)

  const {
    stockName,
    currentShares,
    currentAvgPrice,
    addShares,
    addPrice,
    targetSellPrice,
  } = nanpin

  // Core Calculations
  const currentTotalCost = currentShares * currentAvgPrice
  const addTotalCost = addShares * addPrice
  const totalShares = currentShares + addShares
  const totalInvestment = currentTotalCost + addTotalCost

  const newAvgPrice =
    totalShares > 0 ? Math.ceil(totalInvestment / totalShares) : 0

  const priceDropAmount = newAvgPrice - currentAvgPrice // negative when averaging down
  const priceDropPercent =
    currentAvgPrice > 0 ? (priceDropAmount / currentAvgPrice) * 100 : 0

  // Recovery needed from current market price (assumed = addPrice) to break-even
  const recoveryNeededBefore =
    addPrice > 0 ? ((currentAvgPrice - addPrice) / addPrice) * 100 : 0
  const recoveryNeededAfter =
    addPrice > 0 ? ((newAvgPrice - addPrice) / addPrice) * 100 : 0

  // Unrealized P&L at addPrice (assuming addPrice is current market price)
  const unrealizedPnL =
    totalShares > 0 ? (addPrice - newAvgPrice) * totalShares : 0

  // Target Sell Simulation
  const profitBeforeNanpin = (targetSellPrice - currentAvgPrice) * currentShares
  const profitAfterNanpin = (targetSellPrice - newAvgPrice) * totalShares
  const profitAfterTax =
    profitAfterNanpin > 0
      ? Math.round(profitAfterNanpin * (1 - 0.20315))
      : profitAfterNanpin

  const handleSaveToHistory = () => {
    saveNanpinHistory({
      label: stockName.trim() || `パターン (${currentShares}株+${addShares}株)`,
      currentShares,
      currentAvgPrice,
      addShares,
      addPrice,
      newAvgPrice,
      totalInvestment,
    })
  }

  const handleSaveToNotebook = () => {
    addSavedStock({
      code: '',
      name: stockName.trim() || `計算メモ (${formatNumber(newAvgPrice)}円)`,
      currentPrice: addPrice,
      avgBuyPrice: newAvgPrice,
      shares: totalShares,
      dividendPerShare: 0,
      perkValue: 0,
      tag: '保有中',
      memo: `ナンピン試算: 旧単価${formatNumber(currentAvgPrice)}円(${currentShares}株) ＋ ${formatNumber(addPrice)}円(${addShares}株) → 新単価${formatNumber(newAvgPrice)}円`,
    })
  }

  // Relative discount presets based on currentAvgPrice
  const discountPresets =
    currentAvgPrice > 0
      ? [
          { label: '-5%', value: Math.round(currentAvgPrice * 0.95) },
          { label: '-10%', value: Math.round(currentAvgPrice * 0.9) },
          { label: '-15%', value: Math.round(currentAvgPrice * 0.85) },
          { label: '-20%', value: Math.round(currentAvgPrice * 0.8) },
          { label: '-30%', value: Math.round(currentAvgPrice * 0.7) },
        ]
      : []

  return (
    <div className="space-y-4 pb-6">
      {/* Sticky / Prominent Summary Result Card */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white rounded-3xl p-5 shadow-lg shadow-emerald-900/10 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -left-6 -bottom-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />

        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-bold tracking-wide backdrop-blur-xs">
              ナンピン後の平均取得単価
            </span>
          </div>
          <button
            type="button"
            onClick={resetNanpin}
            className="flex items-center gap-1 text-xs text-emerald-100 hover:text-white bg-white/10 px-2.5 py-1 rounded-full active:scale-95 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            リセット
          </button>
        </div>

        {/* Main Big Number */}
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-extrabold tracking-tight">
                {formatYen(newAvgPrice)}
              </span>
              <span className="text-sm text-emerald-100 font-medium">/ 1株</span>
            </div>
            <p className="text-xs text-emerald-100 mt-1">
              現在の取得単価 {formatYen(currentAvgPrice)} から{' '}
              <span className="font-bold text-amber-200">
                {priceDropAmount <= 0
                  ? `${formatNumber(Math.abs(priceDropAmount))}円 DOWN`
                  : `${formatNumber(priceDropAmount)}円 UP`}
              </span>
            </p>
          </div>

          {/* Badge showing % change */}
          <div className="bg-white/15 backdrop-blur-xs border border-white/20 rounded-2xl px-3.5 py-2 text-right">
            <div className="text-[11px] text-emerald-100">損益分岐ライン</div>
            <div className="text-lg font-extrabold flex items-center justify-end gap-0.5 text-amber-200">
              <ArrowDownRight className="w-4 h-4" />
              {priceDropPercent > 0 ? '+' : ''}
              {priceDropPercent.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Break-even Recovery Comparison Callout */}
        {addPrice < currentAvgPrice && addPrice > 0 && (
          <div className="mt-3.5 bg-black/15 rounded-2xl p-3 border border-white/10 text-xs space-y-1">
            <div className="flex items-center justify-between text-emerald-100">
              <span>現在値（{formatYen(addPrice)}）からプラス転換まで：</span>
              <span className="line-through opacity-75">
                旧 +{recoveryNeededBefore.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between font-bold text-sm text-white">
              <span className="flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                ナンピン後の必要上昇率
              </span>
              <span className="text-amber-300 text-base">
                あと +{recoveryNeededAfter.toFixed(1)}%（+
                {formatNumber(Math.max(0, newAvgPrice - addPrice))}円）
              </span>
            </div>
          </div>
        )}

        {/* 3 Key Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3.5 border-t border-white/15 text-center">
          <div className="bg-white/10 rounded-xl p-2">
            <div className="text-[11px] text-emerald-100">合計保有株数</div>
            <div className="text-sm font-bold mt-0.5">
              {formatNumber(totalShares)}株
            </div>
          </div>
          <div className="bg-white/10 rounded-xl p-2">
            <div className="text-[11px] text-emerald-100">追加で必要な資金</div>
            <div className="text-sm font-bold mt-0.5 text-amber-200">
              {formatYen(addTotalCost)}
            </div>
          </div>
          <div className="bg-white/10 rounded-xl p-2">
            <div className="text-[11px] text-emerald-100">合計投資元本</div>
            <div className="text-sm font-bold mt-0.5">
              {formatYen(totalInvestment)}
            </div>
          </div>
        </div>
      </div>

      {/* Memo Name & Quick Save Bar */}
      <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-slate-200/80 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={stockName}
          onChange={(e) => updateNanpin({ stockName: e.target.value })}
          placeholder="銘柄名メモ（例：トヨタ、商社株など）"
          className="flex-1 min-w-[160px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="button"
          onClick={handleSaveToHistory}
          className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1 active:scale-95 transition"
        >
          <History className="w-3.5 h-3.5" />
          履歴に残す
        </button>
        <button
          type="button"
          onClick={handleSaveToNotebook}
          className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1 active:scale-95 transition"
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
          ノート登録
        </button>
      </div>

      {/* Section 1: Current Holdings */}
      <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs flex items-center justify-center font-bold">
              1
            </span>
            いま保有している株
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            取得額合計: {formatYen(currentTotalCost)}
          </span>
        </div>

        <NumberControl
          label="現在の保有株数"
          value={currentShares}
          onChange={(val) => updateNanpin({ currentShares: val })}
          min={1}
          max={2000}
          step={100}
          unit="株"
          accentColor="emerald"
          presets={[
            { label: '100株', value: 100 },
            { label: '200株', value: 200 },
            { label: '300株', value: 300 },
            { label: '500株', value: 500 },
            { label: '1,000株', value: 1000 },
          ]}
        />

        <NumberControl
          label="現在の平均取得単価"
          subLabel="（1株あたり）"
          value={currentAvgPrice}
          onChange={(val) => updateNanpin({ currentAvgPrice: val })}
          min={50}
          max={10000}
          step={50}
          unit="円"
          accentColor="emerald"
          presets={[
            { label: '1,000円', value: 1000 },
            { label: '2,000円', value: 2000 },
            { label: '3,000円', value: 3000 },
            { label: '5,000円', value: 5000 },
          ]}
        />
      </div>

      {/* Section 2: Additional Buy (Nanpin) */}
      <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">
              2
            </span>
            追加で買い増す株（ナンピン）
          </h2>
          <span className="text-xs font-semibold text-emerald-700">
            追加資金: {formatYen(addTotalCost)}
          </span>
        </div>

        <NumberControl
          label="追加で買う株数"
          value={addShares}
          onChange={(val) => updateNanpin({ addShares: val })}
          min={1}
          max={2000}
          step={100}
          unit="株"
          accentColor="emerald"
          presets={[
            { label: '100株', value: 100 },
            { label: '200株', value: 200 },
            { label: '300株', value: 300 },
            { label: '500株', value: 500 },
          ]}
        />

        <NumberControl
          label="追加購入する株価"
          subLabel="（いまの株価）"
          value={addPrice}
          onChange={(val) => updateNanpin({ addPrice: val })}
          min={50}
          max={10000}
          step={50}
          unit="円"
          accentColor="emerald"
          presets={discountPresets}
        />

        {/* Current Unrealized P&L Box */}
        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/70 flex items-center justify-between">
          <div className="text-xs text-slate-600">
            <span className="font-bold text-slate-700">株価 {formatYen(addPrice)} 時点の含み損益</span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ※買い増し後の新単価 {formatYen(newAvgPrice)} × {formatNumber(totalShares)}株で計算
            </p>
          </div>
          <div
            className={`text-base font-extrabold ${
              unrealizedPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {formatSignedYen(unrealizedPnL)}
          </div>
        </div>
      </div>

      {/* Section 3: What if it rebounds to X yen? */}
      <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 space-y-3">
        <button
          type="button"
          onClick={() => setShowTargetSim(!showTargetSim)}
          className="w-full flex items-center justify-between text-left"
        >
          <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
            「いくらまで戻ればプラス？」売却シミュレーター
          </h2>
          <span className="text-xs text-indigo-600 font-bold">
            {showTargetSim ? '閉じる' : '開く'}
          </span>
        </button>

        {showTargetSim && (
          <div className="space-y-3 pt-1">
            <NumberControl
              label="目標・予想株価"
              subLabel="（ここまで戻ったら売却）"
              value={targetSellPrice}
              onChange={(val) => updateNanpin({ targetSellPrice: val })}
              min={50}
              max={10000}
              step={50}
              unit="円"
              accentColor="indigo"
              presets={[
                { label: `新単価(${newAvgPrice}円)`, value: newAvgPrice },
                {
                  label: `中間(${Math.round((currentAvgPrice + newAvgPrice) / 2)}円)`,
                  value: Math.round((currentAvgPrice + newAvgPrice) / 2),
                },
                { label: `旧単価(${currentAvgPrice}円)`, value: currentAvgPrice },
                {
                  label: `旧単価+5%`,
                  value: Math.round(currentAvgPrice * 1.05),
                },
              ]}
            />

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <div className="text-xs text-slate-500 font-medium">
                  もしナンピンしなかった場合
                </div>
                <div className="text-[11px] text-slate-400">
                  （{currentShares}株 / 単価{formatNumber(currentAvgPrice)}円）
                </div>
                <div
                  className={`text-lg font-extrabold mt-1 ${
                    profitBeforeNanpin >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {formatSignedYen(profitBeforeNanpin)}
                </div>
              </div>

              <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3">
                <div className="text-xs text-indigo-900 font-bold">
                  ナンピンした場合の損益
                </div>
                <div className="text-[11px] text-indigo-600">
                  （{totalShares}株 / 新単価{formatNumber(newAvgPrice)}円）
                </div>
                <div
                  className={`text-lg font-extrabold mt-1 ${
                    profitAfterNanpin >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {formatSignedYen(profitAfterNanpin)}
                </div>
                {profitAfterNanpin > 0 && (
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    特定口座(税引後): <span className="font-bold">{formatSignedYen(profitAfterTax)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 text-xs text-amber-900">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">ワンポイント：</span>
                ナンピン買いは平均単価が下がってプラス転換しやすくなる反面、保有株数が増えるため、さらに下落したときの含み損も大きくなります。余力の範囲で計画的に行うのがコツです。
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Saved Nanpin History Section */}
      {nanpinHistory.length > 0 && (
        <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <History className="w-4 h-4 text-emerald-600" />
              保存した計算履歴（タップで復元）
            </h3>
            <span className="text-xs text-slate-400">{nanpinHistory.length}件</span>
          </div>

          <div className="space-y-2">
            {nanpinHistory.map((h) => (
              <div
                key={h.id}
                onClick={() =>
                  updateNanpin({
                    stockName: h.label,
                    currentShares: h.currentShares,
                    currentAvgPrice: h.currentAvgPrice,
                    addShares: h.addShares,
                    addPrice: h.addPrice,
                  })
                }
                className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/50 border border-slate-200/80 cursor-pointer transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {h.label}
                    </span>
                    <span className="text-[10px] text-slate-400">{h.createdAt}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    旧 {formatNumber(h.currentAvgPrice)}円({h.currentShares}株) ＋ 追加{' '}
                    {formatNumber(h.addPrice)}円({h.addShares}株)
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-extrabold text-emerald-700">
                      新単価 {formatYen(h.newAvgPrice)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      計 {formatYen(h.totalInvestment)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNanpinHistory(h.id)
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg"
                    aria-label="履歴を削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
