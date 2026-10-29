import { useState } from 'react'
import {
  Activity,
  BookMarked,
  Calculator,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Loader2,
  Smartphone,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { useStockStore, type TabType } from './store/useStockStore'
import { OcoCalculator } from './components/OcoCalculator'
import { VwapOrderBookSimulator } from './components/VwapOrderBookSimulator'
import { VwapBandSimulator } from './components/VwapBandSimulator'
import { NanpinCalculator } from './components/NanpinCalculator'
import { DividendCalculator } from './components/DividendCalculator'
import { CompoundSimulator } from './components/CompoundSimulator'
import { StockNotebook } from './components/StockNotebook'
import { SheetSyncModal } from './components/SheetSyncModal'

const NAV_ITEMS: {
  id: TabType
  label: string
  sub: string
  icon: typeof Calculator
}[] = [
  {
    id: 'oco',
    label: 'OCO即算',
    sub: '買い・空売り',
    icon: Zap,
  },
  {
    id: 'vwap_board',
    label: '板・歩み値',
    sub: 'VWAP攻防',
    icon: Layers,
  },
  {
    id: 'vwap_band',
    label: 'VWAP±2σ',
    sub: '日中バンド',
    icon: Activity,
  },
  {
    id: 'nanpin',
    label: 'ナンピン',
    sub: '平均単価',
    icon: Calculator,
  },
  {
    id: 'notebook',
    label: '株ノート',
    sub: '銘柄・NISA',
    icon: BookMarked,
  },
]

export function App() {
  const { activeTab, setActiveTab, toastMessage, gasUrl, isSyncing } =
    useStockStore()
  const [showPwaGuide, setShowPwaGuide] = useState(false)
  const [showSheetSync, setShowSheetSync] = useState(false)

  return (
    <div className="min-h-screen bg-slate-200/70 flex justify-center">
      {/* Mobile-first App Container */}
      <div className="w-full max-w-md min-h-screen bg-slate-50 flex flex-col relative shadow-2xl shadow-slate-900/10">
        {/* Top App Bar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-3.5 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/icon.svg"
              alt="かぶポケ"
              className="w-8 h-8 rounded-xl shadow-xs shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-extrabold tracking-tight text-slate-900 truncate">
                  かぶポケ
                </h1>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold shrink-0">
                  OCO＆VWAP
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate">
                OCO即算・VWAP板読み・±2σシミュレーター
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowSheetSync(true)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border active:scale-95 transition ${
                gasUrl
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent'
              }`}
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>シート連携</span>
              {gasUrl && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowPwaGuide(true)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition"
              aria-label="ホーム画面に追加する方法"
              title="ホーム画面に追加する方法"
            >
              <Smartphone className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </header>

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-xs w-full px-4 pointer-events-none animate-bounce">
            <div className="bg-slate-900/95 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-lg flex items-center justify-center gap-2 border border-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Main Scrollable Content Area */}
        <main className="flex-1 px-3.5 pt-3.5 pb-24 overflow-x-hidden">
          {activeTab === 'oco' && <OcoCalculator />}
          {activeTab === 'vwap_board' && <VwapOrderBookSimulator />}
          {activeTab === 'vwap_band' && <VwapBandSimulator />}
          {activeTab === 'nanpin' && <NanpinCalculator />}
          {activeTab === 'dividend' && <DividendCalculator />}
          {activeTab === 'compound' && <CompoundSimulator />}
          {activeTab === 'notebook' && <StockNotebook />}
        </main>

        {/* Fixed Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-1.5 pt-1.5 pb-safe shadow-[0_-4px_20px_rgba(15,23,42,0.06)]">
          <div className="grid grid-cols-5 gap-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-2xl transition active:scale-95 ${
                    isActive
                      ? 'text-emerald-600 bg-emerald-50/80 font-extrabold'
                      : 'text-slate-400 hover:text-slate-600 font-medium'
                  }`}
                >
                  <div className="relative">
                    <Icon
                      className={`w-5 h-5 transition-transform ${
                        isActive ? 'scale-110 stroke-[2.5px]' : 'stroke-2'
                      }`}
                    />
                    {isActive && (
                      <span className="absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  <span className="text-[10px] mt-1 leading-none tracking-tight">
                    {item.label}
                  </span>
                  <span className="text-[8px] text-slate-400 mt-0.5 leading-none tracking-tight">
                    {item.sub}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Google Spreadsheet Sync Modal */}
        {showSheetSync && (
          <SheetSyncModal onClose={() => setShowSheetSync(false)} />
        )}

        {/* PWA Home Screen Installation Guide Modal */}
        {showPwaGuide && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowPwaGuide(false)}
          >
            <div
              className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src="/icon.svg"
                    alt="かぶポケ"
                    className="w-8 h-8 rounded-xl"
                  />
                  <h2 className="text-base font-extrabold text-slate-900">
                    スマホのホーム画面に追加する方法
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPwaGuide(false)}
                  className="p-1.5 rounded-full bg-slate-100 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                ホーム画面に追加すると、アドレスバーが消えて<strong>本物のスマホアプリのように全画面でサッと起動</strong>できるようになります（オフラインでも動きます！）。
              </p>

              <div className="space-y-2.5 text-xs">
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 space-y-1">
                  <div className="font-extrabold text-emerald-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    iPhone（Safari）の場合
                  </div>
                  <ol className="list-decimal list-inside text-slate-700 space-y-1 pt-1">
                    <li>
                      画面下の<strong>「共有ボタン（四角から上矢印）」</strong>をタップ
                    </li>
                    <li>
                      メニューから<strong>「ホーム画面に追加」</strong>をタップ
                    </li>
                  </ol>
                </div>

                <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-3.5 space-y-1">
                  <div className="font-extrabold text-indigo-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Android（Chrome）の場合
                  </div>
                  <ol className="list-decimal list-inside text-slate-700 space-y-1 pt-1">
                    <li>
                      右上の<strong>「︙（メニュー）」</strong>をタップ
                    </li>
                    <li>
                      <strong>「アプリをインストール」</strong>または<strong>「ホーム画面に追加」</strong>をタップ
                    </li>
                  </ol>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPwaGuide(false)}
                className="w-full py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-bold"
              >
                わかりました！
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
