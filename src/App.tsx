import { useState } from 'react'
import {
  BookMarked,
  Calculator,
  CheckCircle2,
  Coins,
  Smartphone,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react'
import { useStockStore, type TabType } from './store/useStockStore'
import { NanpinCalculator } from './components/NanpinCalculator'
import { DividendCalculator } from './components/DividendCalculator'
import { CompoundSimulator } from './components/CompoundSimulator'
import { StockNotebook } from './components/StockNotebook'

const NAV_ITEMS: {
  id: TabType
  label: string
  sub: string
  icon: typeof Calculator
}[] = [
  {
    id: 'nanpin',
    label: 'ナンピン',
    sub: '平均単価・損益',
    icon: Calculator,
  },
  {
    id: 'dividend',
    label: '配当・NISA',
    sub: '利回り・優待',
    icon: Coins,
  },
  {
    id: 'compound',
    label: '積立・複利',
    sub: '将来グラフ',
    icon: TrendingUp,
  },
  {
    id: 'notebook',
    label: '株ノート',
    sub: '銘柄・用語集',
    icon: BookMarked,
  },
]

export function App() {
  const { activeTab, setActiveTab, toastMessage } = useStockStore()
  const [showPwaGuide, setShowPwaGuide] = useState(false)

  return (
    <div className="min-h-screen bg-slate-200/70 flex justify-center">
      {/* Mobile-first App Container */}
      <div className="w-full max-w-md min-h-screen bg-slate-50 flex flex-col relative shadow-2xl shadow-slate-900/10">
        {/* Top App Bar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/icon.svg"
              alt="かぶポケ"
              className="w-9 h-9 rounded-xl shadow-xs"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-extrabold tracking-tight text-slate-900">
                  かぶポケ
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                  株計算＆NISA
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                自動保存つき・スマホ専用株シミュレーター
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPwaGuide(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 active:scale-95 transition"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
            <span>ホーム画面へ追加</span>
          </button>
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
          {activeTab === 'nanpin' && <NanpinCalculator />}
          {activeTab === 'dividend' && <DividendCalculator />}
          {activeTab === 'compound' && <CompoundSimulator />}
          {activeTab === 'notebook' && <StockNotebook />}
        </main>

        {/* Fixed Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 pt-1.5 pb-safe shadow-[0_-4px_20px_rgba(15,23,42,0.06)]">
          <div className="grid grid-cols-4 gap-1">
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
                  className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition active:scale-95 ${
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
                  <span className="text-[11px] mt-1 leading-none">
                    {item.label}
                  </span>
                  <span className="text-[9px] text-slate-400 mt-0.5 leading-none">
                    {item.sub}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>

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
