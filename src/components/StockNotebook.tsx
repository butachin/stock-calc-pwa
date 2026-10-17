import React, { useState } from 'react'
import {
  BookOpen,
  Calculator,
  CheckCircle2,
  Coins,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import {
  useStockStore,
  type SavedStock,
  type StockTag,
} from '../store/useStockStore'
import { formatNumber, formatSignedYen, formatYen } from '../utils/format'

const TAG_STYLES: Record<StockTag, string> = {
  保有中: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  NISA候補: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  気になる: 'bg-amber-100 text-amber-800 border-amber-200',
}

const GLOSSARY_ITEMS = [
  {
    term: 'PER（株価収益率）',
    reading: 'ピー・イー・アール',
    benchmark: '目安：15倍以下なら割安',
    summary: '「今の株価が、1株あたりの純利益の何年分か」を表す指標です。',
    tip: '日本株の平均は15倍前後。10〜12倍以下だと「利益に対して株価がお買い得（割安）」と言われます。ただし急成長企業は30倍以上になることもあります。',
  },
  {
    term: 'PBR（株価純資産倍率）',
    reading: 'ピー・ビー・アール',
    benchmark: '目安：1.0倍割れは解散価値以下',
    summary: '「会社の持つ純資産（財産）に対して株価が何倍か」を表します。',
    tip: '1倍ちょうど＝会社を今すぐ解散して財産を分けた金額と同じ。1倍未満（0.7倍など）は底値が堅い割安株として注目されやすいです。',
  },
  {
    term: 'ROE（自己資本利益率）',
    reading: 'アール・オー・イー',
    benchmark: '目安：8%〜10%以上なら優秀',
    summary: '「株主が出したお金を使って、どれだけ上手に利益を稼いでいるか」の効率スコアです。',
    tip: 'ROEが高い会社はお金を稼ぐのが上手！逆にPER・PBRが低くてもROEが極端に低い（3%未満など）場合は、万年割安株のまま放置されることもあるので要注意です。',
  },
  {
    term: '配当利回り ＆ 配当性向',
    reading: 'はいとうりまわり / はいとうせいこう',
    benchmark: '目安：利回り3.5%以上・配当性向30〜50%',
    summary: '投資額に対して年間何%の配当がもらえるか（利回り）と、利益のうち何%を配当に回しているか（配当性向）です。',
    tip: '利回りが4%以上あると「高配当株」と呼ばれます。ただし配当性向が80%〜100%を超えていると無理して配当を出している可能性があり、将来の減配リスクに注意しましょう。',
  },
  {
    term: '権利確定日 ＆ 権利落ち日',
    reading: 'けんりかくていび / けんりおちび',
    benchmark: '超重要：月末の2営業日前までに買う！',
    summary: '配当金や株主優待をもらうために、株を保有していなければならない期限の日（権利付き最終日）です。',
    tip: '翌営業日の「権利落ち日」には、配当や優待の分だけ株価がカnd（下落）しやすいため、直前の高値づかみには気をつけましょう。',
  },
  {
    term: '新NISA（成長投資枠・つみたて投資枠）',
    reading: 'しんニーサ',
    benchmark: '生涯非課税枠：合計1,800万円まで',
    summary: '通常は利益や配当金から約20.315%引かれる税金が、ずっと「0円（非課税）」になるおトクな制度です。',
    tip: '個別株や高配当株は「成長投資枠（年間240万円・最大1,200万円まで）」で買うことができます。売却すると翌年に非課税枠が復活するのも嬉しいポイント！',
  },
]

export const StockNotebook: React.FC = () => {
  const {
    savedStocks,
    addSavedStock,
    deleteSavedStock,
    loadStockToNanpin,
    loadStockToDividend,
    loadStockToOco,
  } = useStockStore()

  const [subTab, setSubTab] = useState<'stocks' | 'study'>('stocks')
  const [filterTag, setFilterTag] = useState<StockTag | 'ALL'>('ALL')
  const [isAdding, setIsAdding] = useState(false)

  // New stock form state
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [currentPrice, setCurrentPrice] = useState('2000')
  const [avgBuyPrice, setAvgBuyPrice] = useState('2000')
  const [shares, setShares] = useState('100')
  const [dividendPerShare, setDividendPerShare] = useState('80')
  const [perkValue, setPerkValue] = useState('0')
  const [tag, setTag] = useState<StockTag>('気になる')
  const [memo, setMemo] = useState('')

  // Valuation Checker (PER / PBR) state
  const [checkPer, setCheckPer] = useState(12.5)
  const [checkPbr, setCheckPbr] = useState(0.95)

  const filteredStocks =
    filterTag === 'ALL'
      ? savedStocks
      : savedStocks.filter((s) => s.tag === filterTag)

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    addSavedStock({
      code: code.trim(),
      name: name.trim(),
      currentPrice: Math.max(0, Number(currentPrice) || 0),
      avgBuyPrice: Math.max(0, Number(avgBuyPrice) || Number(currentPrice) || 0),
      shares: Math.max(1, Number(shares) || 100),
      dividendPerShare: Math.max(0, Number(dividendPerShare) || 0),
      perkValue: Math.max(0, Number(perkValue) || 0),
      tag,
      memo: memo.trim(),
    })

    setCode('')
    setName('')
    setMemo('')
    setIsAdding(false)
  }

  // Valuation Checker Calculations
  const mixIndex = checkPer * checkPbr // Graham's number <= 22.5 is value
  const impliedRoe = checkPer > 0 ? (checkPbr / checkPer) * 100 : 0

  return (
    <div className="space-y-4 pb-6">
      {/* Sub-navigation Pill Switcher */}
      <div className="bg-slate-200/80 p-1 rounded-2xl grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setSubTab('stocks')}
          className={`py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
            subTab === 'stocks'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Coins className="w-4 h-4 text-emerald-600" />
          マイ銘柄メモ ({savedStocks.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('study')}
          className={`py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
            subTab === 'study'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4 text-indigo-600" />
          割安チェッカー＆用語集
        </button>
      </div>

      {subTab === 'stocks' ? (
        <div className="space-y-3.5">
          {/* Filter Bar & Add Button */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              {(['ALL', '保有中', 'NISA候補', '気になる'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterTag(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                    filterTag === t
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {t === 'ALL' ? 'すべて' : t}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsAdding(!isAdding)}
              className="px-3.5 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 shadow-xs active:scale-95 transition"
            >
              {isAdding ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  閉じる
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  銘柄を追加
                </>
              )}
            </button>
          </div>

          {/* Add Stock Form Card */}
          {isAdding && (
            <form
              onSubmit={handleAddSubmit}
              className="bg-white rounded-3xl p-4 shadow-md border-2 border-emerald-500/40 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-800">
                  新しい銘柄メモを登録
                </h3>
                <div className="flex gap-1">
                  {(['気になる', 'NISA候補', '保有中'] as StockTag[]).map(
                    (t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTag(t)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          tag === t
                            ? TAG_STYLES[t]
                            : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-500">
                    証券コード
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="8306"
                    className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-slate-500">
                    銘柄名 *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例：トヨタ自動車、イオンなど"
                    className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-500">
                    現在株価(円)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={currentPrice}
                    onChange={(e) => setCurrentPrice(e.target.value)}
                    className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">
                    取得単価(円)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={avgBuyPrice}
                    onChange={(e) => setAvgBuyPrice(e.target.value)}
                    className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">
                    株数(株)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-500">
                    1株配当金(円/年)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={dividendPerShare}
                    onChange={(e) => setDividendPerShare(e.target.value)}
                    className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">
                    優待換算額(円/年)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={perkValue}
                    onChange={(e) => setPerkValue(e.target.value)}
                    className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500">
                  ひとことメモ（狙い目株価や優待内容など）
                </label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="例：3月権利確定。2,000円以下になったら買いたい！"
                  className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-sm active:scale-98 transition"
              >
                マイ銘柄ノートに保存する
              </button>
            </form>
          )}

          {/* Stock Cards List */}
          <div className="space-y-3">
            {filteredStocks.map((stock: SavedStock) => {
              const totalCost = stock. currentPrice * stock.shares
              const divYield =
                stock.currentPrice > 0
                  ? (stock.dividendPerShare / stock.currentPrice) * 100
                  : 0
              const perkYield =
                totalCost > 0 ? (stock.perkValue / totalCost) * 100 : 0
              const totalYield = divYield + perkYield
              const pnl =
                (stock.currentPrice - stock.avgBuyPrice) * stock.shares

              return (
                <div
                  key={stock.id}
                  className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            TAG_STYLES[stock.tag]
                          }`}
                        >
                          {stock.tag}
                        </span>
                        {stock.code && (
                          <span className="text-xs font-mono font-bold text-slate-400">
                            [{stock.code}]
                          </span>
                        )}
                        <h3 className="text-sm font-extrabold text-slate-900">
                          {stock.name}
                        </h3>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteSavedStock(stock.id)}
                      className="p-1 text-slate-300 hover:text-rose-500 transition"
                      aria-label="銘柄を削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-2xl p-2.5 text-center border border-slate-100">
                    <div>
                      <div className="text-[10px] text-slate-400">現在株価</div>
                      <div className="text-sm font-extrabold text-slate-800">
                        {formatYen(stock.currentPrice)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {formatNumber(stock.shares)}株 ({formatYen(totalCost)})
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400">
                        取得単価 / 損益
                      </div>
                      <div className="text-sm font-extrabold text-slate-700">
                        {formatYen(stock.avgBuyPrice)}
                      </div>
                      <div
                        className={`text-[10px] font-bold ${
                          pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {formatSignedYen(pnl)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400">
                        総合利回り(NISA)
                      </div>
                      <div className="text-sm font-extrabold text-indigo-600">
                        {totalYield.toFixed(2)}%
                      </div>
                      <div className="text-[10px] text-slate-400">
                        配当{stock.dividendPerShare}円
                        {stock.perkValue > 0 && '+優待'}
                      </div>
                    </div>
                  </div>

                  {stock.memo && (
                    <p className="text-xs text-slate-600 bg-amber-50/60 border border-amber-100 rounded-xl px-3 py-2">
                      📝 {stock.memo}
                    </p>
                  )}

                  {/* Quick Jump Actions */}
                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => loadStockToOco(stock, 'long')}
                      className="py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95 transition"
                    >
                      ⚡ OCO即算
                    </button>
                    <button
                      type="button"
                      onClick={() => loadStockToNanpin(stock)}
                      className="py-2 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95 transition"
                    >
                      <Calculator className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ナンピン
                    </button>
                    <button
                      type="button"
                      onClick={() => loadStockToDividend(stock)}
                      className="py-2 px-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95 transition"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      配当NISA
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Study & Valuation Checker Sub-Tab */
        <div className="space-y-4">
          {/* Interactive PER / PBR / ROE Quick Checker */}
          <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-lg space-y-4">
            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-bold">
                かんたん割安度チェッカー
              </span>
              <h2 className="text-base font-extrabold mt-1.5">
                PERとPBRを入れるだけで「お買い得度」を診断！
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Yahoo!ファイナンス等で見かけた数字を入れてみましょう
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 border border-white/15 rounded-2xl p-3">
                <label className="text-xs text-slate-300 font-bold block">
                  PER（株価収益率）
                </label>
                <div className="flex items-baseline gap-1 mt-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={checkPer}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      setCheckPer(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    className="w-full bg-white/10 rounded-xl px-2.5 py-1.5 text-right font-extrabold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <span className="text-xs text-slate-300 shrink-0">倍</span>
                </div>
                <div className="text-[11px] mt-1.5 font-bold text-amber-300">
                  {checkPer > 0 && checkPer <= 12
                    ? '◎ かなり割安水準'
                    : checkPer <= 16
                    ? '◯ 標準〜適正水準'
                    : '△ やや割高・成長期待'}
                </div>
              </div>

              <div className="bg-white/10 border border-white/15 rounded-2xl p-3">
                <label className="text-xs text-slate-300 font-bold block">
                  PBR（株価純資産倍率）
                </label>
                <div className="flex items-baseline gap-1 mt-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={checkPbr}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      setCheckPbr(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    className="w-full bg-white/10 rounded-xl px-2.5 py-1.5 text-right font-extrabold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <span className="text-xs text-slate-300 shrink-0">倍</span>
                </div>
                <div className="text-[11px] mt-1.5 font-bold text-emerald-300">
                  {checkPbr > 0 && checkPbr <= 1.0
                    ? '◎ 1倍割れのお買い得水準'
                    : checkPbr <= 2.0
                    ? '◯ 標準的な水準'
                    : '△ 資産面ではやや割高'}
                </div>
              </div>
            </div>

            {/* Diagnosis Result Row */}
            <div className="grid grid-cols-2 gap-2.5 bg-black/25 rounded-2xl p-3 border border-white/10">
              <div>
                <div className="text-[11px] text-slate-300">
                  ミックス係数 (PER×PBR)
                </div>
                <div className="text-lg font-extrabold text-amber-300 mt-0.5">
                  {mixIndex.toFixed(1)}
                </div>
                <div className="text-[10px] text-slate-300">
                  {mixIndex <= 22.5
                    ? '✨ 22.5以下で割安合格！'
                    : '目安は22.5以下が割安'}
                </div>
              </div>

              <div className="border-l border-white/15 pl-3">
                <div className="text-[11px] text-slate-300">
                  推定ROE (稼ぐ効率)
                </div>
                <div className="text-lg font-extrabold text-emerald-300 mt-0.5">
                  {impliedRoe.toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-300">
                  {impliedRoe >= 8.0
                    ? '✨ 8%以上の優良ライン！'
                    : '目安は8%以上が理想'}
                </div>
              </div>
            </div>
          </div>

          {/* Beginner Glossary Cards */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-extrabold text-slate-800 px-1">
              株の勉強ミニ辞典（目安の数字つき）
            </h3>
            {GLOSSARY_ITEMS.map((item) => (
              <div
                key={item.term}
                className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 space-y-2"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      {item.term}
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {item.reading}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {item.benchmark}
                  </span>
                </div>

                <p className="text-xs font-bold text-slate-700">
                  {item.summary}
                </p>
                <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-2.5 leading-relaxed">
                  💡 {item.tip}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
