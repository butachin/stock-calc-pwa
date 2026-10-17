import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TabType = 'nanpin' | 'dividend' | 'compound' | 'notebook'

export type StockTag = '保有中' | '気になる' | 'NISA候補'

export interface SavedStock {
  id: string
  code: string
  name: string
  currentPrice: number
  avgBuyPrice: number
  shares: number
  dividendPerShare: number
  perkValue: number
  tag: StockTag
  memo: string
  updatedAt: string
}

export interface NanpinHistoryItem {
  id: string
  label: string
  currentShares: number
  currentAvgPrice: number
  addShares: number
  addPrice: number
  newAvgPrice: number
  totalInvestment: number
  createdAt: string
}

export interface NanpinState {
  stockName: string
  currentShares: number
  currentAvgPrice: number
  addShares: number
  addPrice: number
  targetSellPrice: number
}

export interface DividendState {
  stockName: string
  stockPrice: number
  dividendPerShare: number
  shares: number
  perkValue: number
  isNisa: boolean
  targetMonthlyDividend: number
}

export interface CompoundState {
  initialManYen: number
  monthlyManYen: number
  annualRate: number
  years: number
  isNisa: boolean
}

interface StockStore {
  activeTab: TabType
  toastMessage: string | null
  nanpin: NanpinState
  nanpinHistory: NanpinHistoryItem[]
  dividend: DividendState
  compound: CompoundState
  savedStocks: SavedStock[]

  setActiveTab: (tab: TabType) => void
  showToast: (msg: string) => void
  updateNanpin: (partial: Partial<NanpinState>) => void
  resetNanpin: () => void
  saveNanpinHistory: (item: Omit<NanpinHistoryItem, 'id' | 'createdAt'>) => void
  deleteNanpinHistory: (id: string) => void

  updateDividend: (partial: Partial<DividendState>) => void
  updateCompound: (partial: Partial<CompoundState>) => void

  addSavedStock: (stock: Omit<SavedStock, 'id' | 'updatedAt'>) => void
  updateSavedStock: (id: string, stock: Partial<Omit<SavedStock, 'id' | 'updatedAt'>>) => void
  deleteSavedStock: (id: string) => void
  loadStockToNanpin: (stock: SavedStock) => void
  loadStockToDividend: (stock: SavedStock) => void
}

const DEFAULT_NANPIN: NanpinState = {
  stockName: '',
  currentShares: 100,
  currentAvgPrice: 2500,
  addShares: 100,
  addPrice: 2000,
  targetSellPrice: 2350,
}

const DEFAULT_DIVIDEND: DividendState = {
  stockName: '',
  stockPrice: 3000,
  dividendPerShare: 120,
  shares: 100,
  perkValue: 3000,
  isNisa: true,
  targetMonthlyDividend: 10000,
}

const DEFAULT_COMPOUND: CompoundState = {
  initialManYen: 10,
  monthlyManYen: 3,
  annualRate: 5.0,
  years: 20,
  isNisa: true,
}

const INITIAL_SAVED_STOCKS: SavedStock[] = [
  {
    id: 'sample-1',
    code: '8306',
    name: '三菱UFJフィナンシャルG（サンプル）',
    currentPrice: 1850,
    avgBuyPrice: 1980,
    shares: 100,
    dividendPerShare: 60,
    perkValue: 0,
    tag: '保有中',
    memo: '増配傾向が続く大型銀行株。1,750円付近まで下がったら100株ナンピン検討',
    updatedAt: 'サンプル',
  },
  {
    id: 'sample-2',
    code: '9432',
    name: '日本電信電話 NTT（サンプル）',
    currentPrice: 155,
    avgBuyPrice: 168,
    shares: 1000,
    dividendPerShare: 5.2,
    perkValue: 1500,
    tag: 'NISA候補',
    memo: '少額から買いやすく長期保有でdポイント優待もあり。新NISA成長投資枠の定番',
    updatedAt: 'サンプル',
  },
  {
    id: 'sample-3',
    code: '8267',
    name: 'イオン（サンプル）',
    currentPrice: 3650,
    avgBuyPrice: 3650,
    shares: 100,
    dividendPerShare: 40,
    perkValue: 10000,
    tag: '気になる',
    memo: 'オーナーズカード（お買い物3%キャッシュバック）を年間1万円相当として総合利回りを計算',
    updatedAt: 'サンプル',
  },
]

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const useStockStore = create<StockStore>()(
  persist(
    (set, get) => ({
      activeTab: 'nanpin',
      toastMessage: null,
      nanpin: DEFAULT_NANPIN,
      nanpinHistory: [],
      dividend: DEFAULT_DIVIDEND,
      compound: DEFAULT_COMPOUND,
      savedStocks: INITIAL_SAVED_STOCKS,

      setActiveTab: (tab) => set({ activeTab: tab }),

      showToast: (msg) => {
        if (toastTimer) clearTimeout(toastTimer)
        set({ toastMessage: msg })
        toastTimer = setTimeout(() => {
          set({ toastMessage: null })
        }, 2800)
      },

      updateNanpin: (partial) =>
        set((state) => ({
          nanpin: { ...state.nanpin, ...partial },
        })),

      resetNanpin: () =>
        set({
          nanpin: DEFAULT_NANPIN,
        }),

      saveNanpinHistory: (item) => {
        const now = new Date()
        const timeStr = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        const newItem: NanpinHistoryItem = {
          ...item,
          id: `hist-${Date.now()}`,
          createdAt: timeStr,
        }
        set((state) => ({
          nanpinHistory: [newItem, ...state.nanpinHistory].slice(0, 15),
        }))
        get().showToast('計算結果を履歴に保存しました')
      },

      deleteNanpinHistory: (id) =>
        set((state) => ({
          nanpinHistory: state.nanpinHistory.filter((item) => item.id !== id),
        })),

      updateDividend: (partial) =>
        set((state) => ({
          dividend: { ...state.dividend, ...partial },
        })),

      updateCompound: (partial) =>
        set((state) => ({
          compound: { ...state.compound, ...partial },
        })),

      addSavedStock: (stock) => {
        const now = new Date()
        const dateStr = `${now.getMonth() + 1}/${now.getDate()}`
        const newStock: SavedStock = {
          ...stock,
          id: `stock-${Date.now()}`,
          updatedAt: dateStr,
        }
        set((state) => ({
          savedStocks: [newStock, ...state.savedStocks],
        }))
        get().showToast(`「${stock.name}」をマイ銘柄に保存しました`)
      },

      updateSavedStock: (id, partial) => {
        const now = new Date()
        const dateStr = `${now.getMonth() + 1}/${now.getDate()}`
        set((state) => ({
          savedStocks: state.savedStocks.map((s) =>
            s.id === id ? { ...s, ...partial, updatedAt: dateStr } : s
          ),
        }))
        get().showToast('銘柄メモを更新しました')
      },

      deleteSavedStock: (id) => {
        set((state) => ({
          savedStocks: state.savedStocks.filter((s) => s.id !== id),
        }))
        get().showToast('銘柄メモを削除しました')
      },

      loadStockToNanpin: (stock) => {
        set({
          activeTab: 'nanpin',
          nanpin: {
            stockName: stock.name,
            currentShares: stock.shares > 0 ? stock.shares : 100,
            currentAvgPrice: stock.avgBuyPrice > 0 ? stock.avgBuyPrice : stock.currentPrice,
            addShares: 100,
            addPrice: stock.currentPrice,
            targetSellPrice: Math.round(
              ((stock.avgBuyPrice > 0 ? stock.avgBuyPrice : stock.currentPrice) + stock.currentPrice) / 2
            ),
          },
        })
        get().showToast(`「${stock.name}」をナンピン計算機に読み込みました`)
      },

      loadStockToDividend: (stock) => {
        set({
          activeTab: 'dividend',
          dividend: {
            ...get().dividend,
            stockName: stock.name,
            stockPrice: stock.currentPrice,
            dividendPerShare: stock.dividendPerShare,
            shares: stock.shares > 0 ? stock.shares : 100,
            perkValue: stock.perkValue,
          },
        })
        get().showToast(`「${stock.name}」を配当シミュレーターに読み込みました`)
      },
    }),
    {
      name: 'kabu-pocket-storage-v1',
      partialize: (state) => ({
        activeTab: state.activeTab,
        nanpin: state.nanpin,
        nanpinHistory: state.nanpinHistory,
        dividend: state.dividend,
        compound: state.compound,
        savedStocks: state.savedStocks,
      }),
    }
  )
)
