import React, { useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  BookmarkPlus,
  Copy,
  History,
  RefreshCw,
  Settings2,
  Trash2,
  Zap,
} from 'lucide-react'
import { useStockStore } from '../store/useStockStore'
import { formatNumber, formatYen } from '../utils/format'

export const OcoCalculator: React.FC = () => {
  const {
    oco,
    ocoHistory,
    updateOco,
    saveOcoHistory,
    deleteOcoHistory,
    showToast,
  } = useStockStore()

  const [showSettings, setShowSettings] = useState(false)
  const [showBothSides, setShowBothSides] = useState(true)

  const {
    side,
    priceInput,
    sharesInput,
    manualShares,
    tpPercent,
    slPercent,
    budgetYen,
    memoLabel,
  } = oco

  const p = parseFloat(priceInput)
  const isValidPrice = Number.isFinite(p) && p > 0

  // Auto shares calculation (same logic as her HTML: Math.max(100, Math.floor(400000 / p / 100) * 100))
  const autoShares = isValidPrice
    ? Math.max(100, Math.floor(budgetYen / p / 100) * 100)
    : 100

  const activeShares = manualShares
    ? parseInt(sharesInput, 10) || 100
    : autoShares

  // Calculate Long (買い)
  const longTp = isValidPrice ? Math.round(p * (1 + tpPercent / 100)) : 0
  const longSl = isValidPrice ? Math.round(p * (1 - slPercent / 100)) : 0
  const longTpDiff = isValidPrice ? longTp - p : 0
  const longSlDiff = isValidPrice ? longSl - p : 0 // negative
  const longTpProfit = Math.round(longTpDiff * activeShares)
  const longSlLoss = Math.round(longSlDiff * activeShares) // negative

  // Calculate Short (空売り)
  const shortTp = isValidPrice ? Math.round(p * (1 - tpPercent / 100)) : 0
  const shortSl = isValidPrice ? Math.round(p * (1 + slPercent / 100)) : 0
  const shortTpDiff = isValidPrice ? shortTp - p : 0 // negative price change = profit
  const shortSlDiff = isValidPrice ? shortSl - p : 0 // positive price change = loss
  const shortTpProfit = Math.round((p - shortTp) * activeShares) // positive profit
  const shortSlLoss = Math.round((p - shortSl) * activeShares) // negative loss

  // Active side values
  const isLong = side === 'long'
  const activeTp = isLong ? longTp : shortTp
  const activeSl = isLong ? longSl : shortSl
  const activeTpDiff = isLong ? longTpDiff : shortTpDiff
  const activeSlDiff = isLong ? longSlDiff : shortSlDiff
  const activeTpProfit = isLong ? longTpProfit : shortTpProfit
  const activeSlLoss = isLong ? longSlLoss : shortSlLoss

  const totalCost = isValidPrice ? Math.round(p * activeShares) : 0
  const isOverBudget = totalCost > 500000

  // Handlers matching her HTML's calc() and calc(true)
  const handlePriceChange = (raw: string) => {
    const parsed = parseFloat(raw)
    if (!manualShares && Number.isFinite(parsed) && parsed > 0) {
      const nextAuto = Math.max(100, Math.floor(budgetYen / parsed / 100) * 100)
      updateOco({
        priceInput: raw,
        sharesInput: String(nextAuto),
      })
    } else {
      updateOco({ priceInput: raw })
    }
  }

  const handleSharesChange = (raw: string) => {
    if (raw === '') {
      // Just like her HTML: if shares input is cleared, revert to auto calculation!
      updateOco({
        sharesInput: isValidPrice ? String(autoShares) : '',
        manualShares: false,
      })
      return
    }
    updateOco({
      sharesInput: raw,
      manualShares: true,
    })
  }

  const handleResetToAutoShares = () => {
    updateOco({
      manualShares: false,
      sharesInput: String(autoShares),
    })
    showToast(`株数を自動計算（${budgetYen / 10000}万円枠）に戻しました`)
  }

  const handleCopyPrice = async (priceVal: number, label: string) => {
    if (!isValidPrice || priceVal <= 0) return
    try {
      await navigator.clipboard.writeText(String(priceVal))
      showToast(`${label}「${priceVal}円」をコピーしました`)
    } catch {
      // ignore
    }
  }

  const handleSaveHistory = () => {
    if (!isValidPrice) return
    saveOcoHistory({
      side,
      label:
        memoLabel.trim() ||
        `${isLong ? '買い' : '空売り'} ${formatNumber(p)}円`,
      entryPrice: p,
      shares: activeShares,
      tpPrice: activeTp,
      slPrice: activeSl,
      tpProfit: activeTpProfit,
      slLoss: activeSlLoss,
      totalCost,
    })
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Main Dark OCO Box (Matching her exact dark theme aesthetic & layout!) */}
      <div className="bg-[#1e2433] text-white rounded-3xl p-4 shadow-xl border border-slate-700/80 space-y-3.5">
        {/* Title & Settings Button */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[#60a5fa] flex items-center gap-1.5">
            <Zap className="w-4 h-4 fill-[#60a5fa] text-[#60a5fa]" />
            OCO即算電卓（{isLong ? '+' : '-'}
            {tpPercent}% / {isLong ? '-' : '+'}
            {slPercent}%）
          </h2>

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 border border-slate-600 transition"
          >
            <Settings2 className="w-3.5 h-3.5" />
            %設定
          </button>
        </div>

        {/* Long (買い) vs Short (空売り) Big Switcher */}
        <div className="grid grid-cols-2 gap-2 bg-[#0f172a] p-1.5 rounded-2xl border border-slate-700">
          <button
            type="button"
            onClick={() => updateOco({ side: 'long' })}
            className={`py-2.5 px-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-1.5 transition ${
              isLong
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            📈 買い（ロング）
          </button>

          <button
            type="button"
            onClick={() => updateOco({ side: 'short' })}
            className={`py-2.5 px-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-1.5 transition ${
              !isLong
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
            📉 空売り（ショート）
          </button>
        </div>

        {/* Optional % & Budget Customization Drawer */}
        {showSettings && (
          <div className="bg-[#0f172a] rounded-2xl p-3.5 border border-slate-700 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300">
                利確・損切ライン＆1枠予算設定
              </span>
              <button
                type="button"
                onClick={() =>
                  updateOco({
                    tpPercent: 4.0,
                    slPercent: 1.5,
                    budgetYen: 400000,
                    manualShares: false,
                  })
                }
                className="text-[11px] text-[#60a5fa] font-bold hover:underline"
              >
                初期値(+4% / -1.5% / 40万)に戻す
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] text-emerald-400 font-bold block mb-1">
                  利確幅 (%)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={tpPercent}
                  onChange={(e) =>
                    updateOco({
                      tpPercent: Math.max(0.1, parseFloat(e.target.value) || 4),
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-right font-bold text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-rose-400 font-bold block mb-1">
                  損切幅 (%)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={slPercent}
                  onChange={(e) =>
                    updateOco({
                      slPercent: Math.max(
                        0.1,
                        parseFloat(e.target.value) || 1.5
                      ),
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-right font-bold text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-amber-400 font-bold block mb-1">
                  1枠目安(万円)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  step="5"
                  value={budgetYen / 10000}
                  onChange={(e) => {
                    const man = Math.max(10, parseInt(e.target.value, 10) || 40)
                    updateOco({
                      budgetYen: man * 10000,
                      manualShares: false,
                    })
                  }}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-right font-bold text-white"
                />
              </div>
            </div>

            {/* Quick Style Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { label: '標準 (+4% / -1.5%)', tp: 4.0, sl: 1.5 },
                { label: 'スキャル (+2% / -1%)', tp: 2.0, sl: 1.0 },
                { label: '順張り (+5% / -2%)', tp: 5.0, sl: 2.0 },
                { label: 'タイト (+3% / -1%)', tp: 3.0, sl: 1.0 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    updateOco({ tpPercent: preset.tp, slPercent: preset.sl })
                  }
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                    tpPercent === preset.tp && slPercent === preset.sl
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Row: Entry Price & Shares (Exact layout as her HTML!) */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs text-slate-400 font-bold mb-1">
              {isLong ? '買値（円）を入力' : '売値（空売り単価）を入力'}
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={priceInput}
              onFocus={(e) => e.target.select()}
              onChange={(e) => handlePriceChange(e.target.value)}
              placeholder="例: 354"
              className="w-full rounded-xl border border-slate-600 bg-[#0f172a] text-white text-right font-extrabold px-3 py-2.5 text-xl focus:outline-none focus:border-[#60a5fa] focus:ring-2 focus:ring-[#60a5fa]/30"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400 font-bold">
                株数{manualShares ? '（手入力中）' : `（自動${budgetYen / 10000}万枠）`}
              </label>
              {manualShares && (
                <button
                  type="button"
                  onClick={handleResetToAutoShares}
                  className="text-[10px] text-[#60a5fa] flex items-center gap-0.5 font-bold hover:underline"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  自動に戻す
                </button>
              )}
            </div>
            <input
              type="number"
              inputMode="numeric"
              step="100"
              value={manualShares ? sharesInput : isValidPrice ? autoShares : ''}
              onFocus={(e) => e.target.select()}
              onChange={(e) => handleSharesChange(e.target.value)}
              placeholder="例: 500"
              className="w-full rounded-xl border border-slate-600 bg-[#0f172a] text-white text-right font-extrabold px-3 py-2.5 text-xl focus:outline-none focus:border-[#60a5fa] focus:ring-2 focus:ring-[#60a5fa]/30"
            />
          </div>
        </div>

        {/* Quick +/-100 Shares Stepper Pills */}
        <div className="flex items-center justify-between gap-1.5 text-xs">
          <span className="text-[11px] text-slate-400">
            株数クイック調整：
          </span>
          <div className="flex items-center gap-1.5">
            {[
              { label: '-100株', delta: -100 },
              { label: '+100株', delta: 100 },
              { label: '自動(40万枠)', reset: true },
            ].map((btn) => (
              <button
                key={btn.label}
                type="button"
                onClick={() => {
                  if (btn.reset) {
                    handleResetToAutoShares()
                  } else {
                    const next = Math.max(100, activeShares + (btn.delta || 0))
                    updateOco({
                      manualShares: true,
                      sharesInput: String(next),
                    })
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-[#0f172a] hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold active:scale-95 transition"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Card 1: Take Profit (🎯 利確指値) */}
        <div
          onClick={() => handleCopyPrice(activeTp, '利確指値')}
          className="rounded-2xl p-3.5 bg-emerald-500/15 border border-emerald-500 flex items-center justify-between cursor-pointer active:scale-[0.99] transition"
        >
          <div>
            <div className="text-xs font-extrabold text-[#6ee7b7] flex items-center gap-1.5">
              <span>
                🎯 利確指値（{isLong ? `+${tpPercent.toFixed(1)}%` : `-${tpPercent.toFixed(1)}% 買戻し`}）
              </span>
              <Copy className="w-3 h-3 opacity-70" />
            </div>
            <div className="text-xs text-slate-300 mt-1">
              {isValidPrice
                ? `${isLong ? '買値' : '売値'} ${activeTpDiff >= 0 ? '+' : ''}${activeTpDiff.toFixed(1)}円`
                : '---'}
            </div>
            <div className="text-[10px] text-emerald-300/70 mt-0.5">
              {isValidPrice
                ? `理論値: ${(isLong ? p * (1 + tpPercent / 100) : p * (1 - tpPercent / 100)).toFixed(1)}円`
                : ''}
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl font-extrabold text-[#34d399] tracking-tight">
              {isValidPrice ? `${activeTp.toLocaleString()} 円` : '--- 円'}
            </div>
            <div className="text-xs text-slate-200 font-bold mt-0.5">
              利益: +{isValidPrice ? activeTpProfit.toLocaleString() : 0}円
            </div>
          </div>
        </div>

        {/* Card 2: Stop Loss (🛡️ 逆指値損切) */}
        <div
          onClick={() => handleCopyPrice(activeSl, '逆指値損切')}
          className="rounded-2xl p-3.5 bg-red-500/15 border border-red-500 flex items-center justify-between cursor-pointer active:scale-[0.99] transition"
        >
          <div>
            <div className="text-xs font-extrabold text-[#fca5a5] flex items-center gap-1.5">
              <span>
                🛡️ 逆指値損切（{isLong ? `-${slPercent.toFixed(1)}%` : `+${slPercent.toFixed(1)}% 買戻し`}）
              </span>
              <Copy className="w-3 h-3 opacity-70" />
            </div>
            <div className="text-xs text-slate-300 mt-1">
              {isValidPrice
                ? `${isLong ? '買値' : '売値'} ${activeSlDiff >= 0 ? '+' : ''}${activeSlDiff.toFixed(1)}円`
                : '---'}
            </div>
            <div className="text-[10px] text-rose-300/70 mt-0.5">
              {isValidPrice
                ? `理論値: ${(isLong ? p * (1 - slPercent / 100) : p * (1 + slPercent / 100)).toFixed(1)}円`
                : ''}
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl font-extrabold text-[#f87171] tracking-tight">
              {isValidPrice ? `${activeSl.toLocaleString()} 円` : '--- 円'}
            </div>
            <div className="text-xs text-slate-200 font-bold mt-0.5">
              損失: {isValidPrice ? activeSlLoss.toLocaleString() : 0}円
            </div>
          </div>
        </div>

        {/* Card 3: Total Investment Info */}
        <div
          className={`rounded-2xl p-3 bg-[#0f172a] border flex items-center justify-between ${
            isOverBudget ? 'border-amber-500/80' : 'border-slate-700'
          }`}
        >
          <div>
            <span className="text-xs text-slate-300 font-bold block">
              💰 投資金額（目安上限40万〜50万円）
            </span>
            {isOverBudget && (
              <span className="text-[11px] text-amber-400 font-bold">
                ⚠️ 50万円を超えています（株数を確認してください）
              </span>
            )}
          </div>
          <strong className="text-lg font-extrabold text-[#fbbf24]">
            {totalCost.toLocaleString()} 円
          </strong>
        </div>
      </div>

      {/* Side-by-Side Comparison Card (買い vs 空売り 同時早見表) */}
      {isValidPrice && (
        <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-700">
              ⚡ 株価 {p.toLocaleString()}円（{activeShares}株）の「買い / 空売り」両面早見表
            </h3>
            <button
              type="button"
              onClick={() => setShowBothSides(!showBothSides)}
              className="text-xs text-emerald-600 font-bold"
            >
              {showBothSides ? '隠す' : '表示'}
            </button>
          </div>

          {showBothSides && (
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              {/* Long Column */}
              <div
                onClick={() => updateOco({ side: 'long' })}
                className={`rounded-2xl p-3 border cursor-pointer transition ${
                  isLong
                    ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 border-slate-200 opacity-80'
                }`}
              >
                <div className="font-extrabold text-emerald-800 flex items-center justify-between mb-1.5">
                  <span>📈 買い（ロング）</span>
                  {isLong && (
                    <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full">
                      選択中
                    </span>
                  )}
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-500">🎯 利確(+{tpPercent}%)</span>
                  <span className="font-extrabold text-emerald-700">
                    {longTp.toLocaleString()}円
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">🛡️ 損切(-{slPercent}%)</span>
                  <span className="font-extrabold text-rose-600">
                    {longSl.toLocaleString()}円
                  </span>
                </div>
              </div>

              {/* Short Column */}
              <div
                onClick={() => updateOco({ side: 'short' })}
                className={`rounded-2xl p-3 border cursor-pointer transition ${
                  !isLong
                    ? 'bg-rose-50/70 border-rose-400 ring-2 ring-rose-500/20'
                    : 'bg-slate-50 border-slate-200 opacity-80'
                }`}
              >
                <div className="font-extrabold text-rose-800 flex items-center justify-between mb-1.5">
                  <span>📉 空売り（ショート）</span>
                  {!isLong && (
                    <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full">
                      選択中
                    </span>
                  )}
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-500">🎯 利確(-{tpPercent}%)</span>
                  <span className="font-extrabold text-emerald-700">
                    {shortTp.toLocaleString()}円
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">🛡️ 損切(+{slPercent}%)</span>
                  <span className="font-extrabold text-rose-600">
                    {shortSl.toLocaleString()}円
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save OCO Memo Bar */}
      <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-slate-200/80 flex items-center gap-2">
        <input
          type="text"
          value={memoLabel}
          onChange={(e) => updateOco({ memoLabel: e.target.value })}
          placeholder="銘柄名・メモ（例：レーザーテック、重工など）"
          className="flex-1 min-w-[140px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="button"
          onClick={handleSaveHistory}
          className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1 shrink-0 active:scale-95 transition"
        >
          <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
          OCO履歴に保存
        </button>
      </div>

      {/* Saved OCO History List */}
      {ocoHistory.length > 0 && (
        <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-700" />
              保存したOCO注文メモ（タップで復元）
            </h3>
            <span className="text-xs text-slate-400">{ocoHistory.length}件</span>
          </div>

          <div className="space-y-2">
            {ocoHistory.map((item) => (
              <div
                key={item.id}
                onClick={() =>
                  updateOco({
                    side: item.side,
                    priceInput: String(item.entryPrice),
                    sharesInput: String(item.shares),
                    manualShares: true,
                    memoLabel: item.label,
                  })
                }
                className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 cursor-pointer transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        item.side === 'long'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {item.side === 'long' ? '📈 買い' : '📉 空売り'}
                    </span>
                    <span className="text-xs font-extrabold text-slate-800 truncate">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {item.createdAt}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    単価 <strong>{formatNumber(item.entryPrice)}円</strong> ×{' '}
                    {formatNumber(item.shares)}株（{formatYen(item.totalCost)}）
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right text-xs">
                    <div className="font-extrabold text-emerald-700">
                      🎯 利確 {formatNumber(item.tpPrice)}円
                    </div>
                    <div className="font-extrabold text-rose-600">
                      🛡️ 損切 {formatNumber(item.slPrice)}円
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteOcoHistory(item.id)
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
