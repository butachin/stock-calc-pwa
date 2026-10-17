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

  // Google Spreadsheet Sync State
  gasUrl: string
  syncPasscode: string
  autoSync: boolean
  lastSyncedAt: string | null
  isSyncing: boolean

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

  // Google Spreadsheet Sync Actions
  setSyncConfig: (config: { gasUrl?: string; syncPasscode?: string; autoSync?: boolean }) => void
  pushToSheet: (silent?: boolean) => Promise<boolean>
  pullFromSheet: () => Promise<boolean>
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

      gasUrl: import.meta.env.VITE_GAS_URL || '',
      syncPasscode: '',
      autoSync: true,
      lastSyncedAt: null,
      isSyncing: false,

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
        if (get().gasUrl && get().autoSync) {
          void get().pushToSheet(true)
        }
      },

      deleteNanpinHistory: (id) => {
        set((state) => ({
          nanpinHistory: state.nanpinHistory.filter((item) => item.id !== id),
        }))
        if (get().gasUrl && get().autoSync) {
          void get().pushToSheet(true)
        }
      },

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
        if (get().gasUrl && get().autoSync) {
          void get().pushToSheet(true)
        }
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
        if (get().gasUrl && get().autoSync) {
          void get().pushToSheet(true)
        }
      },

      deleteSavedStock: (id) => {
        set((state) => ({
          savedStocks: state.savedStocks.filter((s) => s.id !== id),
        }))
        get().showToast('銘柄メモを削除しました')
        if (get().gasUrl && get().autoSync) {
          void get().pushToSheet(true)
        }
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

      setSyncConfig: (config) =>
        set((state) => ({
          gasUrl: config.gasUrl !== undefined ? config.gasUrl.trim() : state.gasUrl,
          syncPasscode:
            config.syncPasscode !== undefined ? config.syncPasscode.trim() : state.syncPasscode,
          autoSync: config.autoSync !== undefined ? config.autoSync : state.autoSync,
        })),

      pushToSheet: async (silent = false) => {
        const { gasUrl, syncPasscode, savedStocks, nanpinHistory } = get()
        if (!gasUrl) {
          if (!silent) get().showToast('スプレッドシートのURLを設定してください')
          return false
        }
        set({ isSyncing: true })
        try {
          // Using text/plain avoids CORS preflight OPTIONS failure on Google Apps Script
          const res = await fetch(gasUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({
              action: 'save',
              passcode: syncPasscode,
              savedStocks,
              nanpinHistory,
            }),
            redirect: 'follow',
          })
          const data = await res.json()
          if (data && data.ok) {
            set({
              lastSyncedAt: data.updatedAt || 'たった今',
              isSyncing: false,
            })
            if (!silent) {
              get().showToast('Googleスプレッドシートへ保存しました！')
            }
            return true
          } else {
            throw new Error(data?.error || '保存に失敗しました')
          }
        } catch (err) {
          set({ isSyncing: false })
          if (!silent) {
            get().showToast(
              `同期エラー: ${err instanceof Error ? err.message : 'URLを確認してください'}`
            )
          }
          return false
        }
      },

      pullFromSheet: async () => {
        const { gasUrl, syncPasscode } = get()
        if (!gasUrl) {
          get().showToast('スプレッドシートのURLを設定してください')
          return false
        }
        set({ isSyncing: true })
        try {
          const res = await fetch(gasUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({
              action: 'load',
              passcode: syncPasscode,
            }),
            redirect: 'follow',
          })
          const data = await res.json()
          if (data && data.ok) {
            set((state) => ({
              savedStocks:
                Array.isArray(data.savedStocks) && data.savedStocks.length > 0
                  ? data.savedStocks
                  : state.savedStocks,
              nanpinHistory: Array.isArray(data.nanpinHistory)
                ? data.nanpinHistory
                : state.nanpinHistory,
              lastSyncedAt: data.updatedAt || 'たった今',
              isSyncing: false,
            }))
            get().showToast('スプレッドシートから最新データを読み込みました！')
            return true
          } else {
            throw new Error(data?.error || '読み込みに失敗しました')
          }
        } catch (err) {
          set({ isSyncing: false })
          get().showToast(
            `読込エラー: ${err instanceof Error ? err.message : 'URLを確認してください'}`
          )
          return false
        }
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
        gasUrl: state.gasUrl,
        syncPasscode: state.syncPasscode,
        autoSync: state.autoSync,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
)
