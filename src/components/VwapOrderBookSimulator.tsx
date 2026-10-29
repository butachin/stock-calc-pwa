import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Flame,
  HelpCircle,
  Layers,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

// ============================================================================
// 型定義および完全版データセット（全シナリオ・全ステップ完全収録）
// ============================================================================

export type ActionStatus = 'wait' | 'buy' | 'sell_or_cut'

export type OrderBookHighlight =
  | 'iceberg'
  | 'cancel'
  | 'cap'
  | 'support'
  | 'eat'
  | null

export interface OrderBookRow {
  price: number
  askVolume: number
  bidVolume: number
  isVwap?: boolean
  highlight?: OrderBookHighlight
  note?: string
}

export interface TimeAndSalesRow {
  id: string
  time: string
  price: number
  volume: number
  side: 'buy' | 'sell'
  isLarge?: boolean
}

export interface SimulatorStep {
  stepNumber: number
  stepTitle: string
  currentPrice: number
  diagnosis: {
    status: ActionStatus
    badgeText: string
    anomalyText: string
    description: string
  }
  orderBook: OrderBookRow[]
  timeAndSales: TimeAndSalesRow[]
}

export interface VwapScenario {
  id: string
  name: string
  shortName: string
  direction: 'from_above' | 'from_below'
  steps: SimulatorStep[]
}

export const VWAP_PRICE = 5000
const MAX_DEPTH_VOLUME = 45000

export const VWAP_SCENARIOS: VwapScenario[] = [
  {
    id: 'scenario_1',
    name: '① 押し目反発（アイスバーグ吸収）',
    shortName: '① 押し目反発',
    direction: 'from_above',
    steps: [
      {
        stepNumber: 1,
        stepTitle: 'VWAPへの接近',
        currentPrice: 5002,
        diagnosis: {
          status: 'wait',
          badgeText: '様子見・待機',
          anomalyText: 'VWAP（5,000円）の買い板に15,000株の待機注文',
          description:
            '高値圏から利益確定売りで調整中。5,000円のVWAPラインで売りが吸収されるか、板の減り方を監視します。',
        },
        orderBook: [
          { price: 5004, askVolume: 8200, bidVolume: 0 },
          { price: 5003, askVolume: 6500, bidVolume: 0 },
          { price: 5002, askVolume: 4100, bidVolume: 2300 },
          { price: 5001, askVolume: 0, bidVolume: 5800 },
          {
            price: 5000,
            askVolume: 0,
            bidVolume: 15000,
            isVwap: true,
            note: 'VWAP基準線',
          },
          { price: 4999, askVolume: 0, bidVolume: 9200 },
          { price: 4998, askVolume: 0, bidVolume: 11000 },
          { price: 4997, askVolume: 0, bidVolume: 7500 },
          { price: 4996, askVolume: 0, bidVolume: 12400 },
        ],
        timeAndSales: [
          {
            id: '1-1',
            time: '09:42:08',
            price: 5002,
            volume: 1200,
            side: 'sell',
          },
          {
            id: '1-2',
            time: '09:42:05',
            price: 5002,
            volume: 800,
            side: 'sell',
          },
          {
            id: '1-3',
            time: '09:42:01',
            price: 5003,
            volume: 500,
            side: 'buy',
          },
          {
            id: '1-4',
            time: '09:41:58',
            price: 5003,
            volume: 2500,
            side: 'sell',
          },
        ],
      },
      {
        stepNumber: 2,
        stepTitle: 'VWAP到達・大口売りのステルス吸収',
        currentPrice: 5000,
        diagnosis: {
          status: 'wait',
          badgeText: '反発準備（吸収確認）',
          anomalyText:
            '歩み値で14,000株売られたのに、5,000円の買い板が14,500株残存！',
          description:
            '5,000円に大口成行売りがぶつかりましたが、機関投資家のアイスバーグ（ステルス補充）注文が裏で+13,500株自動補充し、売りを完全吸収しています。',
        },
        orderBook: [
          { price: 5004, askVolume: 8500, bidVolume: 0 },
          { price: 5003, askVolume: 7200, bidVolume: 0 },
          { price: 5002, askVolume: 5400, bidVolume: 0 },
          { price: 5001, askVolume: 3800, bidVolume: 0 },
          {
            price: 5000,
            askVolume: 0,
            bidVolume: 14500,
            isVwap: true,
            highlight: 'iceberg',
            note: '裏で+13,500株ステルス補充',
          },
          { price: 4999, askVolume: 0, bidVolume: 9500 },
          { price: 4998, askVolume: 0, bidVolume: 11200 },
          { price: 4997, askVolume: 0, bidVolume: 7800 },
          { price: 4996, askVolume: 0, bidVolume: 12400 },
        ],
        timeAndSales: [
          {
            id: '1-8',
            time: '09:42:19',
            price: 5000,
            volume: 6000,
            side: 'sell',
            isLarge: true,
          },
          {
            id: '1-7',
            time: '09:42:18',
            price: 5000,
            volume: 8000,
            side: 'sell',
            isLarge: true,
          },
          {
            id: '1-6',
            time: '09:42:15',
            price: 5001,
            volume: 5800,
            side: 'sell',
            isLarge: true,
          },
          {
            id: '1-5',
            time: '09:42:11',
            price: 5002,
            volume: 2300,
            side: 'sell',
          },
        ],
      },
      {
        stepNumber: 3,
        stepTitle: '売り枯れ（約定スピード急減速）',
        currentPrice: 5000,
        diagnosis: {
          status: 'wait',
          badgeText: 'エントリー待機（売り枯れ）',
          anomalyText:
            '約定サイズが100〜300株に縮小し、売りの勢いが完全に停止',
          description:
            '大口の売り玉が出尽くし、歩み値の更新スピードがピタッと遅くなりました。次は1ティック上の5,001円が買われる瞬間を待ちます。',
        },
        orderBook: [
          { price: 5004, askVolume: 8500, bidVolume: 0 },
          { price: 5003, askVolume: 7000, bidVolume: 0 },
          { price: 5002, askVolume: 5100, bidVolume: 0 },
          { price: 5001, askVolume: 3200, bidVolume: 0 },
          {
            price: 5000,
            askVolume: 0,
            bidVolume: 16200,
            isVwap: true,
            highlight: 'support',
            note: '買い板さらに増加',
          },
          { price: 4999, askVolume: 0, bidVolume: 9800 },
          { price: 4998, askVolume: 0, bidVolume: 11200 },
          { price: 4997, askVolume: 0, bidVolume: 7800 },
          { price: 4996, askVolume: 0, bidVolume: 12400 },
        ],
        timeAndSales: [
          {
            id: '1-12',
            time: '09:42:35',
            price: 5000,
            volume: 100,
            side: 'sell',
          },
          {
            id: '1-11',
            time: '09:42:31',
            price: 5000,
            volume: 200,
            side: 'sell',
          },
          {
            id: '1-10',
            time: '09:42:26',
            price: 5000,
            volume: 300,
            side: 'sell',
          },
          {
            id: '1-9',
            time: '09:42:21',
            price: 5000,
            volume: 400,
            side: 'sell',
          },
        ],
      },
      {
        stepNumber: 4,
        stepTitle: '上値食い（反発シグナル点灯）',
        currentPrice: 5001,
        diagnosis: {
          status: 'buy',
          badgeText: '買いエントリー好機！',
          anomalyText: '5,001円の売り板3,200株を一気食いし、買い板へ転換',
          description:
            '売り枯れを確認した大口が5,001円・5,002円の売り板をまとめて買い上がりました。5,000円割れを損切りラインに設定して順張り買いを入れる絶好のタイミングです。',
        },
        orderBook: [
          { price: 5004, askVolume: 8200, bidVolume: 0 },
          { price: 5003, askVolume: 6400, bidVolume: 0 },
          { price: 5002, askVolume: 1900, bidVolume: 0 },
          {
            price: 5001,
            askVolume: 0,
            bidVolume: 9400,
            highlight: 'eat',
            note: '上値食い＋買い板化',
          },
          {
            price: 5000,
            askVolume: 0,
            bidVolume: 18500,
            isVwap: true,
            highlight: 'support',
            note: '強固なサポート',
          },
          { price: 4999, askVolume: 0, bidVolume: 10200 },
          { price: 4998, askVolume: 0, bidVolume: 11200 },
          { price: 4997, askVolume: 0, bidVolume: 7800 },
          { price: 4996, askVolume: 0, bidVolume: 12400 },
        ],
        timeAndSales: [
          {
            id: '1-15',
            time: '09:42:40',
            price: 5002,
            volume: 3200,
            side: 'buy',
          },
          {
            id: '1-14',
            time: '09:42:39',
            price: 5001,
            volume: 8500,
            side: 'buy',
            isLarge: true,
          },
          {
            id: '1-13',
            time: '09:42:38',
            price: 5001,
            volume: 3200,
            side: 'buy',
          },
          {
            id: '1-12',
            time: '09:42:35',
            price: 5000,
            volume: 100,
            side: 'sell',
          },
        ],
      },
      {
        stepNumber: 5,
        stepTitle: 'VWAP反発トレンドの加速',
        currentPrice: 5004,
        diagnosis: {
          status: 'buy',
          badgeText: '利益伸ばし（順張り継続）',
          anomalyText: 'VWAP反発を確認した追随買いで高値更新へ',
          description:
            '5,000円が固い下値支持線として意識され、アルゴリズムと個人の追随買いで一気に上昇が加速しています。',
        },
        orderBook: [
          {
            price: 5004,
            askVolume: 1200,
            bidVolume: 7500,
            highlight: 'eat',
          },
          { price: 5003, askVolume: 0, bidVolume: 11000 },
          { price: 5002, askVolume: 0, bidVolume: 13400 },
          { price: 5001, askVolume: 0, bidVolume: 15200 },
          { price: 5000, askVolume: 0, bidVolume: 19000, isVwap: true },
          { price: 4999, askVolume: 0, bidVolume: 10500 },
          { price: 4998, askVolume: 0, bidVolume: 11200 },
          { price: 4997, askVolume: 0, bidVolume: 7800 },
          { price: 4996, askVolume: 0, bidVolume: 12400 },
        ],
        timeAndSales: [
          {
            id: '1-18',
            time: '09:42:48',
            price: 5004,
            volume: 7000,
            side: 'buy',
            isLarge: true,
          },
          {
            id: '1-17',
            time: '09:42:45',
            price: 5003,
            volume: 6400,
            side: 'buy',
            isLarge: true,
          },
          {
            id: '1-16',
            time: '09:42:42',
            price: 5002,
            volume: 1900,
            side: 'buy',
          },
          {
            id: '1-15',
            time: '09:42:40',
            price: 5002,
            volume: 3200,
            side: 'buy',
          },
        ],
      },
    ],
  },
  {
    id: 'scenario_2',
    name: '② 下抜け貫通（見せ板撤退と蓋かぶせ）',
    shortName: '② 下抜け貫通',
    direction: 'from_above',
    steps: [
      {
        stepNumber: 1,
        stepTitle: '分厚い買い板への接近',
        currentPrice: 5002,
        diagnosis: {
          status: 'wait',
          badgeText: '警戒・監視',
          anomalyText: '5,000円（VWAP）に40,000株の極端に厚い買い板',
          description:
            '一見すると5,000円に40,000株の鉄壁の買い板が見えますが、他の価格帯に比べて不自然に突出しており、見せ板やキャンセルの可能性を警戒します。',
        },
        orderBook: [
          { price: 5004, askVolume: 9500, bidVolume: 0 },
          { price: 5003, askVolume: 11200, bidVolume: 0 },
          { price: 5002, askVolume: 6800, bidVolume: 1500 },
          { price: 5001, askVolume: 0, bidVolume: 4200 },
          {
            price: 5000,
            askVolume: 0,
            bidVolume: 40000,
            isVwap: true,
            note: '一見分厚い4万株の買い板',
          },
          { price: 4999, askVolume: 0, bidVolume: 4500 },
          { price: 4998, askVolume: 0, bidVolume: 5100 },
          { price: 4997, askVolume: 0, bidVolume: 3800 },
          { price: 4996, askVolume: 0, bidVolume: 4900 },
        ],
        timeAndSales: [
          {
            id: '2-3',
            time: '10:14:05',
            price: 5002,
            volume: 2200,
            side: 'sell',
          },
          {
            id: '2-2',
            time: '10:14:02',
            price: 5002,
            volume: 1800,
            side: 'sell',
          },
          {
            id: '2-1',
            time: '10:13:58',
            price: 5003,
            volume: 3100,
            side: 'sell',
          },
        ],
      },
      {
        stepNumber: 2,
        stepTitle: '直前での大量注文取消（板消し）',
        currentPrice: 5001,
        diagnosis: {
          status: 'sell_or_cut',
          badgeText: '危険シグナル（買い見送り）',
          anomalyText:
            '5,000円はまだ約定していないのに、買い板が40,000株→8,000株へ急減！',
          description:
            '株価が5,001円に迫った瞬間、歩み値で約定していないのに5,000円の買い指値32,000株が一斉にキャンセルされました。典型的な見せ板撤退であり、直後に貫通します。',
        },
        orderBook: [
          { price: 5004, askVolume: 9800, bidVolume: 0 },
          { price: 5003, askVolume: 12000, bidVolume: 0 },
          { price: 5002, askVolume: 8900, bidVolume: 0 },
          { price: 5001, askVolume: 4500, bidVolume: 800 },
          {
            price: 5000,
            askVolume: 0,
            bidVolume: 8000,
            isVwap: true,
            highlight: 'cancel',
            note: '約定なしで-32,000株取消！',
          },
          { price: 4999, askVolume: 0, bidVolume: 4500 },
          { price: 4998, askVolume: 0, bidVolume: 5100 },
          { price: 4997, askVolume: 0, bidVolume: 3800 },
          { price: 4996, askVolume: 0, bidVolume: 4900 },
        ],
        timeAndSales: [
          {
            id: '2-5',
            time: '10:14:10',
            price: 5001,
            volume: 3400,
            side: 'sell',
          },
          {
            id: '2-4',
            time: '10:14:08',
            price: 5002,
            volume: 1500,
            side: 'sell',
          },
          {
            id: '2-3',
            time: '10:14:05',
            price: 5002,
            volume: 2200,
            side: 'sell',
          },
        ],
      },
      {
        stepNumber: 3,
        stepTitle: '大口売りによるVWAP一気貫通',
        currentPrice: 4999,
        diagnosis: {
          status: 'sell_or_cut',
          badgeText: 'VWAP割れ発生',
          anomalyText: '10,000株の成行売りで薄くなった5,000円を一撃で貫通',
          description:
            '残っていた8,000株の買い板が1発の成行売りで食い破られ、4,999円へ転落しました。',
        },
        orderBook: [
          { price: 5004, askVolume: 9800, bidVolume: 0 },
          { price: 5003, askVolume: 12000, bidVolume: 0 },
          { price: 5002, askVolume: 9200, bidVolume: 0 },
          { price: 5001, askVolume: 7600, bidVolume: 0 },
          {
            price: 5000,
            askVolume: 2000,
            bidVolume: 0,
            isVwap: true,
            highlight: 'cancel',
            note: 'サポート崩壊',
          },
          { price: 4999, askVolume: 0, bidVolume: 2500 },
          { price: 4998, askVolume: 0, bidVolume: 5100 },
          { price: 4997, askVolume: 0, bidVolume: 3800 },
          { price: 4996, askVolume: 0, bidVolume: 4900 },
        ],
        timeAndSales: [
          {
            id: '2-8',
            time: '10:14:12',
            price: 4999,
            volume: 2000,
            side: 'sell',
          },
          {
            id: '2-7',
            time: '10:14:12',
            price: 5000,
            volume: 8000,
            side: 'sell',
            isLarge: true,
          },
          {
            id: '2-6',
            time: '10:14:11',
            price: 5001,
            volume: 800,
            side: 'sell',
          },
          {
            id: '2-5',
            time: '10:14:10',
            price: 5001,
            volume: 3400,
            side: 'sell',
          },
        ],
      },
      {
        stepNumber: 4,
        stepTitle: '5,000円への巨大な「売り蓋」出現',
        currentPrice: 4999,
        diagnosis: {
          status: 'sell_or_cut',
          badgeText: '即損切り・ドテン空売り！',
          anomalyText:
            '割れた直後の5,000円（売り板）に35,000株の巨大な蓋が出現',
          description:
            '5,000円を割った0.5秒後、5,000円の売り板に35,000株の大量売り指値が置かれ、V字回復を完全に封じ込めました。買い持ちは1秒も迷わず即撤退すべき瞬間です。',
        },
        orderBook: [
          { price: 5004, askVolume: 9800, bidVolume: 0 },
          { price: 5003, askVolume: 12000, bidVolume: 0 },
          { price: 5002, askVolume: 9500, bidVolume: 0 },
          { price: 5001, askVolume: 11000, bidVolume: 0 },
          {
            price: 5000,
            askVolume: 35000,
            bidVolume: 0,
            isVwap: true,
            highlight: 'cap',
            note: '35,000株の強力な売り蓋！',
          },
          { price: 4999, askVolume: 0, bidVolume: 1200 },
          { price: 4998, askVolume: 0, bidVolume: 4800 },
          { price: 4997, askVolume: 0, bidVolume: 3800 },
          { price: 4996, askVolume: 0, bidVolume: 4900 },
        ],
        timeAndSales: [
          {
            id: '2-9',
            time: '10:14:14',
            price: 4999,
            volume: 1300,
            side: 'sell',
          },
          {
            id: '2-8',
            time: '10:14:12',
            price: 4999,
            volume: 2000,
            side: 'sell',
          },
          {
            id: '2-7',
            time: '10:14:12',
            price: 5000,
            volume: 8000,
            side: 'sell',
            isLarge: true,
          },
        ],
      },
      {
        stepNumber: 5,
        stepTitle: '逆指値（ストップロス）巻き込み急落',
        currentPrice: 4996,
        diagnosis: {
          status: 'sell_or_cut',
          badgeText: '急落（ナイアガラ発生）',
          anomalyText: '個人の逆指値売りが連鎖発動し、歩み値が売り一色に',
          description:
            '5,000円に蓋をされたことで上で買っていた個人の損切り注文が一斉に発動し、一気に4,996円まで急落しました。',
        },
        orderBook: [
          { price: 5004, askVolume: 9800, bidVolume: 0 },
          { price: 5003, askVolume: 12000, bidVolume: 0 },
          { price: 5002, askVolume: 9500, bidVolume: 0 },
          { price: 5001, askVolume: 13500, bidVolume: 0 },
          {
            price: 5000,
            askVolume: 38000,
            bidVolume: 0,
            isVwap: true,
            highlight: 'cap',
          },
          { price: 4999, askVolume: 14200, bidVolume: 0 },
          { price: 4998, askVolume: 9600, bidVolume: 0 },
          { price: 4997, askVolume: 6400, bidVolume: 0 },
          { price: 4996, askVolume: 2100, bidVolume: 3200 },
        ],
        timeAndSales: [
          {
            id: '2-13',
            time: '10:14:19',
            price: 4996,
            volume: 6500,
            side: 'sell',
            isLarge: true,
          },
          {
            id: '2-12',
            time: '10:14:18',
            price: 4997,
            volume: 5800,
            side: 'sell',
            isLarge: true,
          },
          {
            id: '2-11',
            time: '10:14:16',
            price: 4998,
            volume: 7200,
            side: 'sell',
            isLarge: true,
          },
          {
            id: '2-10',
            time: '10:14:15',
            price: 4999,
            volume: 4500,
            side: 'sell',
          },
        ],
      },
    ],
  },
  {
    id: 'scenario_3',
    name: '③ 上抜けブレイク（高速イートとサポレジ転換）',
    shortName: '③ 上抜けブレイク',
    direction: 'from_below',
    steps: [
      {
        stepNumber: 1,
        stepTitle: '下からのVWAP接近（戻り売りの壁）',
        currentPrice: 4998,
        diagnosis: {
          status: 'wait',
          badgeText: 'ブレイク監視',
          anomalyText: '5,000円（VWAP）に30,000株の厚い同値撤退売り板',
          description:
            'VWAPの下から反発してきました。5,000円には含み損を抱えた投資家の「やれやれ売り」30,000株が並んでいます。ここを食い破るスピードに注目します。',
        },
        orderBook: [
          { price: 5004, askVolume: 9200, bidVolume: 0 },
          { price: 5003, askVolume: 8400, bidVolume: 0 },
          { price: 5002, askVolume: 10500, bidVolume: 0 },
          { price: 5001, askVolume: 12000, bidVolume: 0 },
          {
            price: 5000,
            askVolume: 30000,
            bidVolume: 0,
            isVwap: true,
            note: '3万株の戻り売りの壁',
          },
          { price: 4999, askVolume: 4800, bidVolume: 0 },
          { price: 4998, askVolume: 1200, bidVolume: 6500 },
          { price: 4997, askVolume: 0, bidVolume: 8900 },
          { price: 4996, askVolume: 0, bidVolume: 10200 },
        ],
        timeAndSales: [
          {
            id: '3-3',
            time: '11:05:10',
            price: 4998,
            volume: 2400,
            side: 'buy',
          },
          {
            id: '3-2',
            time: '11:05:06',
            price: 4998,
            volume: 1500,
            side: 'buy',
          },
          {
            id: '3-1',
            time: '11:05:01',
            price: 4997,
            volume: 3200,
            side: 'buy',
          },
        ],
      },
      {
        stepNumber: 2,
        stepTitle: '助走なしの連続大口イート開始',
        currentPrice: 5000,
        diagnosis: {
          status: 'wait',
          badgeText: '突破開始（大口参戦）',
          anomalyText:
            '5,000円の壁に対して10,000株・12,000株の成行買いが連続炸裂！',
          description:
            '4,999円を一瞬で通過し、5,000円の30,000株の売り板に対して躊躇なく大口の成行買いが連続でぶつかっています。本物のブレイクの前兆です。',
        },
        orderBook: [
          { price: 5004, askVolume: 9200, bidVolume: 0 },
          { price: 5003, askVolume: 8400, bidVolume: 0 },
          { price: 5002, askVolume: 10500, bidVolume: 0 },
          { price: 5001, askVolume: 12000, bidVolume: 0 },
          {
            price: 5000,
            askVolume: 8000,
            bidVolume: 0,
            isVwap: true,
            highlight: 'eat',
            note: '残り8,000株まで急減！',
          },
          { price: 4999, askVolume: 0, bidVolume: 9500 },
          { price: 4998, askVolume: 0, bidVolume: 11000 },
          { price: 4997, askVolume: 0, bidVolume: 9200 },
          { price: 4996, askVolume: 0, bidVolume: 10200 },
        ],
        timeAndSales: [
          {
            id: '3-6',
            time: '11:05:14',
            price: 5000,
            volume: 12000,
            side: 'buy',
            isLarge: true,
          },
          {
            id: '3-5',
            time: '11:05:13',
            price: 5000,
            volume: 10000,
            side: 'buy',
            isLarge: true,
          },
          {
            id: '3-4',
            time: '11:05:12',
            price: 4999,
            volume: 6000,
            side: 'buy',
            isLarge: true,
          },
          {
            id: '3-3',
            time: '11:05:10',
            price: 4998,
            volume: 2400,
            side: 'buy',
          },
        ],
      },
      {
        stepNumber: 3,
        stepTitle: 'VWAP完全突破（3万株完食）',
        currentPrice: 5001,
        diagnosis: {
          status: 'buy',
          badgeText: 'ブレイク発生（第1波）',
          anomalyText: '5,000円の売り板をわずか3秒で完食し、5,001円へ突入',
          description:
            'さらに15,000株の大口買いが入り、5,000円の売り板をすべて食い切って5,001円まで買い上がりました。次は5,000円が買い板として固まるかを確認します。',
        },
        orderBook: [
          { price: 5004, askVolume: 9200, bidVolume: 0 },
          { price: 5003, askVolume: 8400, bidVolume: 0 },
          { price: 5002, askVolume: 10500, bidVolume: 0 },
          {
            price: 5001,
            askVolume: 5000,
            bidVolume: 3200,
            highlight: 'eat',
          },
          {
            price: 5000,
            askVolume: 0,
            bidVolume: 12000,
            isVwap: true,
            highlight: 'support',
            note: '売り板消滅→買い板転換',
          },
          { price: 4999, askVolume: 0, bidVolume: 11500 },
          { price: 4998, askVolume: 0, bidVolume: 11000 },
          { price: 4997, askVolume: 0, bidVolume: 9200 },
          { price: 4996, askVolume: 0, bidVolume: 10200 },
        ],
        timeAndSales: [
          {
            id: '3-8',
            time: '11:05:15',
            price: 5001,
            volume: 7000,
            side: 'buy',
            isLarge: true,
          },
          {
            id: '3-7',
            time: '11:05:15',
            price: 5000,
            volume: 8000,
            side: 'buy',
            isLarge: true,
          },
          {
            id: '3-6',
            time: '11:05:14',
            price: 5000,
            volume: 12000,
            side: 'buy',
            isLarge: true,
          },
        ],
      },
      {
        stepNumber: 4,
        stepTitle: 'サポレジ転換（土台形成完了）',
        currentPrice: 5001,
        diagnosis: {
          status: 'buy',
          badgeText: '買いエントリー好機（第2波）！',
          anomalyText:
            '5,000円（VWAP）に25,000株の分厚い買い板が積まれ、利確売りを吸収',
          description:
            '突破した5,000円にすぐさま25,000株の買い板が入り、短期筋の利確売り（2,500株）を吸収して5,001円を維持しています。ダマシのリスクが極めて低い絶好の買い場です。',
        },
        orderBook: [
          { price: 5004, askVolume: 9000, bidVolume: 0 },
          { price: 5003, askVolume: 8200, bidVolume: 0 },
          { price: 5002, askVolume: 9800, bidVolume: 0 },
          { price: 5001, askVolume: 2100, bidVolume: 8400 },
          {
            price: 5000,
            askVolume: 0,
            bidVolume: 25000,
            isVwap: true,
            highlight: 'support',
            note: '2.5万株の買い土台完成！',
          },
          { price: 4999, askVolume: 0, bidVolume: 14000 },
          { price: 4998, askVolume: 0, bidVolume: 11000 },
          { price: 4997, askVolume: 0, bidVolume: 9200 },
          { price: 4996, askVolume: 0, bidVolume: 10200 },
        ],
        timeAndSales: [
          {
            id: '3-10',
            time: '11:05:19',
            price: 5001,
            volume: 2900,
            side: 'buy',
          },
          {
            id: '3-9',
            time: '11:05:17',
            price: 5000,
            volume: 2500,
            side: 'sell',
          },
          {
            id: '3-8',
            time: '11:05:15',
            price: 5001,
            volume: 7000,
            side: 'buy',
            isLarge: true,
          },
        ],
      },
      {
        stepNumber: 5,
        stepTitle: '踏み上げ（ショートカバー）による急伸',
        currentPrice: 5004,
        diagnosis: {
          status: 'buy',
          badgeText: 'ブレイク伸長（利益拡大）',
          anomalyText: '空売り勢の買い戻しを巻き込み、連続上値食い',
          description:
            'VWAPで跳ね返されると見ていた空売り勢の損切り（買い戻し）が一斉に始まり、5,004円まで一気に駆け上がりました。',
        },
        orderBook: [
          {
            price: 5004,
            askVolume: 1500,
            bidVolume: 9200,
            highlight: 'eat',
          },
          { price: 5003, askVolume: 0, bidVolume: 12500 },
          { price: 5002, askVolume: 0, bidVolume: 16000 },
          { price: 5001, askVolume: 0, bidVolume: 18400 },
          {
            price: 5000,
            askVolume: 0,
            bidVolume: 26500,
            isVwap: true,
            highlight: 'support',
          },
          { price: 4999, askVolume: 0, bidVolume: 14000 },
          { price: 4998, askVolume: 0, bidVolume: 11000 },
          { price: 4997, askVolume: 0, bidVolume: 9200 },
          { price: 4996, askVolume: 0, bidVolume: 10200 },
        ],
        timeAndSales: [
          {
            id: '3-13',
            time: '11:05:25',
            price: 5004,
            volume: 7500,
            side: 'buy',
            isLarge: true,
          },
          {
            id: '3-12',
            time: '11:05:23',
            price: 5003,
            volume: 8200,
            side: 'buy',
            isLarge: true,
          },
          {
            id: '3-11',
            time: '11:05:21',
            price: 5002,
            volume: 9800,
            side: 'buy',
            isLarge: true,
          },
          {
            id: '3-10',
            time: '11:05:19',
            price: 5001,
            volume: 2900,
            side: 'buy',
          },
        ],
      },
    ],
  },
  {
    id: 'scenario_4',
    name: '④ 戻り跳ね返され（上値売り補充と下値叩き）',
    shortName: '④ 戻り跳ね返され',
    direction: 'from_below',
    steps: [
      {
        stepNumber: 1,
        stepTitle: '自律反発でのVWAP接近',
        currentPrice: 4999,
        diagnosis: {
          status: 'wait',
          badgeText: '上値重さ監視',
          anomalyText: '5,000円（VWAP）に20,000株の売り板',
          description:
            '下落トレンド中の自律反発で5,000円のVWAPに迫っています。買い方がこの20,000株を食い切れるかを確認します。',
        },
        orderBook: [
          { price: 5004, askVolume: 11000, bidVolume: 0 },
          { price: 5003, askVolume: 9500, bidVolume: 0 },
          { price: 5002, askVolume: 12400, bidVolume: 0 },
          { price: 5001, askVolume: 15800, bidVolume: 0 },
          {
            price: 5000,
            askVolume: 20000,
            bidVolume: 0,
            isVwap: true,
            note: 'VWAP抵抗線（2万株）',
          },
          { price: 4999, askVolume: 1800, bidVolume: 5400 },
          { price: 4998, askVolume: 0, bidVolume: 7200 },
          { price: 4997, askVolume: 0, bidVolume: 6500 },
          { price: 4996, askVolume: 0, bidVolume: 8100 },
        ],
        timeAndSales: [
          {
            id: '4-2',
            time: '13:20:05',
            price: 4999,
            volume: 1800,
            side: 'buy',
          },
          {
            id: '4-1',
            time: '13:20:01',
            price: 4998,
            volume: 2500,
            side: 'buy',
          },
        ],
      },
      {
        stepNumber: 2,
        stepTitle: '買っても減らない5,000円の売り板',
        currentPrice: 5000,
        diagnosis: {
          status: 'wait',
          badgeText: '失速警戒（売り補充検知）',
          anomalyText:
            '歩み値で15,000株買われたのに、5,000円の売り板が19,500株残存！',
          description:
            '5,000円に5,000株×3回の買いが入りましたが、大口がVWAPで戻り売りをぶつけ続けており、売り板がまったく減りません。買い持ちなら利確準備です。',
        },
        orderBook: [
          { price: 5004, askVolume: 11000, bidVolume: 0 },
          { price: 5003, askVolume: 9500, bidVolume: 0 },
          { price: 5002, askVolume: 12400, bidVolume: 0 },
          { price: 5001, askVolume: 16200, bidVolume: 0 },
          {
            price: 5000,
            askVolume: 19500,
            bidVolume: 0,
            isVwap: true,
            highlight: 'iceberg',
            note: '裏で+14,500株売り補充！',
          },
          { price: 4999, askVolume: 0, bidVolume: 6800 },
          { price: 4998, askVolume: 0, bidVolume: 7200 },
          { price: 4997, askVolume: 0, bidVolume: 6500 },
          { price: 4996, askVolume: 0, bidVolume: 8100 },
        ],
        timeAndSales: [
          {
            id: '4-5',
            time: '13:20:15',
            price: 5000,
            volume: 5000,
            side: 'buy',
            isLarge: true,
          },
          {
            id: '4-4',
            time: '13:20:12',
            price: 5000,
            volume: 5000,
            side: 'buy',
            isLarge: true,
          },
          {
            id: '4-3',
            time: '13:20:09',
            price: 5000,
            volume: 5000,
            side: 'buy',
            isLarge: true,
          },
        ],
      },
      {
        stepNumber: 3,
        stepTitle: '買い疲れ（VWAP直下での長期停滞）',
        currentPrice: 5000,
        diagnosis: {
          status: 'wait',
          badgeText: '反落直前（買い枯れ）',
          anomalyText: '40秒以上5,000円を抜けれず、買い約定が100〜200株に縮小',
          description:
            '5,000円の壁が厚すぎて買い方が諦め始め、小口の買いしか出なくなりました。4,999円の買い板が叩かれた瞬間が下落再開の合図になります。',
        },
        orderBook: [
          { price: 5004, askVolume: 11000, bidVolume: 0 },
          { price: 5003, askVolume: 9500, bidVolume: 0 },
          { price: 5002, askVolume: 12400, bidVolume: 0 },
          { price: 5001, askVolume: 16500, bidVolume: 0 },
          {
            price: 5000,
            askVolume: 21000,
            bidVolume: 0,
            isVwap: true,
            highlight: 'cap',
            note: '売り板がさらに増加',
          },
          { price: 4999, askVolume: 0, bidVolume: 6200 },
          { price: 4998, askVolume: 0, bidVolume: 7000 },
          { price: 4997, askVolume: 0, bidVolume: 6500 },
          { price: 4996, askVolume: 0, bidVolume: 8100 },
        ],
        timeAndSales: [
          {
            id: '4-8',
            time: '13:20:52',
            price: 5000,
            volume: 100,
            side: 'buy',
          },
          {
            id: '4-7',
            time: '13:20:44',
            price: 5000,
            volume: 200,
            side: 'buy',
          },
          {
            id: '4-6',
            time: '13:20:31',
            price: 5000,
            volume: 100,
            side: 'buy',
          },
        ],
      },
      {
        stepNumber: 4,
        stepTitle: '下値叩き（反落シグナル点灯）',
        currentPrice: 4999,
        diagnosis: {
          status: 'sell_or_cut',
          badgeText: '買い利確・戻り売り好機！',
          anomalyText:
            '4,999円の買い板6,200株が大口売りで一掃され、売り板へ転換',
          description:
            '上値が抜けないと見た大口が4,999円の買い板を9,000株の成行売りで叩き潰しました。5,001円を損切りラインとして空売りを入れる好機です。',
        },
        orderBook: [
          { price: 5004, askVolume: 11000, bidVolume: 0 },
          { price: 5003, askVolume: 9500, bidVolume: 0 },
          { price: 5002, askVolume: 12400, bidVolume: 0 },
          { price: 5001, askVolume: 16500, bidVolume: 0 },
          {
            price: 5000,
            askVolume: 22500,
            bidVolume: 0,
            isVwap: true,
            highlight: 'cap',
          },
          {
            price: 4999,
            askVolume: 4800,
            bidVolume: 0,
            highlight: 'cancel',
            note: '買い板消滅→売り板化！',
          },
          { price: 4998, askVolume: 0, bidVolume: 4200 },
          { price: 4997, askVolume: 0, bidVolume: 6500 },
          { price: 4996, askVolume: 0, bidVolume: 8100 },
        ],
        timeAndSales: [
          {
            id: '4-10',
            time: '13:20:56',
            price: 4998,
            volume: 2800,
            side: 'sell',
          },
          {
            id: '4-9',
            time: '13:20:55',
            price: 4999,
            volume: 9000,
            side: 'sell',
            isLarge: true,
          },
          {
            id: '4-8',
            time: '13:20:52',
            price: 5000,
            volume: 100,
            side: 'buy',
          },
        ],
      },
      {
        stepNumber: 5,
        stepTitle: '失望売りによる下落トレンド再開',
        currentPrice: 4996,
        diagnosis: {
          status: 'sell_or_cut',
          badgeText: '下落加速（戻り売り成功）',
          anomalyText: 'ブレイク期待で買っていた短期筋の投げ売りが連鎖',
          description:
            'VWAP突破失敗が確定したことで短期筋の手仕舞い売りが殺到し、4,996円まで続落しました。',
        },
        orderBook: [
          { price: 5004, askVolume: 11000, bidVolume: 0 },
          { price: 5003, askVolume: 9500, bidVolume: 0 },
          { price: 5002, askVolume: 12400, bidVolume: 0 },
          { price: 5001, askVolume: 16500, bidVolume: 0 },
          { price: 5000, askVolume: 23000, bidVolume: 0, isVwap: true },
          { price: 4999, askVolume: 9500, bidVolume: 0 },
          { price: 4998, askVolume: 8200, bidVolume: 0 },
          { price: 4997, askVolume: 6100, bidVolume: 0 },
          { price: 4996, askVolume: 1900, bidVolume: 3500 },
        ],
        timeAndSales: [
          {
            id: '4-13',
            time: '13:21:04',
            price: 4996,
            volume: 4600,
            side: 'sell',
          },
          {
            id: '4-12',
            time: '13:21:01',
            price: 4997,
            volume: 6500,
            side: 'sell',
            isLarge: true,
          },
          {
            id: '4-11',
            time: '13:20:58',
            price: 4998,
            volume: 4200,
            side: 'sell',
          },
          {
            id: '4-10',
            time: '13:20:56',
            price: 4998,
            volume: 2800,
            side: 'sell',
          },
        ],
      },
    ],
  },
]

// Highlight badge styling helper
function getHighlightBadgeStyle(highlight?: OrderBookHighlight): string {
  switch (highlight) {
    case 'iceberg':
      return 'bg-purple-500/30 text-purple-200 border-purple-400/60'
    case 'cancel':
      return 'bg-rose-500/30 text-rose-200 border-rose-400/60'
    case 'cap':
      return 'bg-red-600/40 text-red-100 border-red-400/80'
    case 'support':
      return 'bg-emerald-500/30 text-emerald-200 border-emerald-400/60'
    case 'eat':
      return 'bg-amber-500/30 text-amber-200 border-amber-400/60'
    default:
      return 'bg-amber-500/20 text-amber-300 border-amber-400/40'
  }
}

export const VwapOrderBookSimulator: React.FC = () => {
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const [isBlindQuizMode, setIsBlindQuizMode] = useState(false)
  const [quizAnswer, setQuizAnswer] = useState<ActionStatus | null>(null)
  const [compactSideBySide, setCompactSideBySide] = useState(false)

  const currentScenario = VWAP_SCENARIOS[scenarioIndex]
  const currentStep = currentScenario.steps[stepIndex]

  // Switch scenario -> reset to Step 1
  const handleSelectScenario = (idx: number) => {
    setScenarioIndex(idx)
    setStepIndex(0)
    setIsAutoPlaying(false)
    setQuizAnswer(null)
  }

  const handleSelectStep = (idx: number) => {
    setStepIndex(idx)
    setIsAutoPlaying(false)
    setQuizAnswer(null)
  }

  // Auto-play timer (1.8 seconds per step)
  useEffect(() => {
    if (!isAutoPlaying) return
    const timer = window.setInterval(() => {
      setStepIndex((prev) => {
        if (prev < currentScenario.steps.length - 1) {
          return prev + 1
        } else {
          setIsAutoPlaying(false)
          return prev
        }
      })
    }, 1800)
    return () => window.clearInterval(timer)
  }, [isAutoPlaying, currentScenario.steps.length])

  // Determine if the diagnosis callout should be hidden in Blind Quiz Mode
  const shouldHideDiagnosis =
    isBlindQuizMode &&
    (currentStep.stepNumber === 3 || currentStep.stepNumber === 4) &&
    quizAnswer === null

  const step5FinalPrice =
    currentScenario.steps[currentScenario.steps.length - 1].currentPrice
  const tickOutcomeFromStep4 =
    step5FinalPrice - currentScenario.steps[3].currentPrice

  // Diagnosis banner colors
  const statusStyles = {
    wait: {
      box: 'bg-slate-800/90 border-amber-500/50 text-slate-100',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-400/50',
      icon: AlertTriangle,
    },
    buy: {
      box: 'bg-emerald-950/80 border-emerald-500 text-emerald-50',
      badge: 'bg-emerald-500 text-slate-950 font-black border-emerald-300',
      icon: TrendingUp,
    },
    sell_or_cut: {
      box: 'bg-rose-950/80 border-rose-500 text-rose-50',
      badge: 'bg-rose-500 text-white font-black border-rose-300',
      icon: ShieldAlert,
    },
  }[currentStep.diagnosis.status]

  const StatusIcon = statusStyles.icon

  return (
    <div className="space-y-3.5 pb-6">
      {/* Main Dark Container */}
      <div className="bg-[#1e2433] text-white rounded-3xl p-4 shadow-xl border border-slate-700/80 space-y-3.5">
        {/* Header & Training Mode Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                VWAP板読み・歩み値 連動シミュレーター
              </h2>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              VWAP（5,000円）攻防時の「大口の吸収・見せ板・上値食い」をステップ再現
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsBlindQuizMode(!isBlindQuizMode)
                setQuizAnswer(null)
              }}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1 border transition active:scale-95 ${
                isBlindQuizMode
                  ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                  : 'bg-[#0f172a] text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
            >
              {isBlindQuizMode ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              {isBlindQuizMode ? 'クイズモードON' : 'クイズ挑戦'}
            </button>

            <button
              type="button"
              onClick={() => setCompactSideBySide(!compactSideBySide)}
              className="px-2.5 py-1.5 rounded-xl bg-[#0f172a] text-slate-300 border border-slate-700 text-[11px] font-bold sm:hidden"
            >
              {compactSideBySide ? '縦並び表示' : '板・歩み値並列'}
            </button>
          </div>
        </div>

        {/* 1. シナリオ選択タブ（上部4パターン） */}
        <div className="grid grid-cols-2 gap-1.5 bg-[#0f172a] p-1.5 rounded-2xl border border-slate-700">
          {VWAP_SCENARIOS.map((sc, idx) => {
            const isSelected = idx === scenarioIndex
            const isFromAbove = sc.direction === 'from_above'
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => handleSelectScenario(idx)}
                className={`py-2 px-2.5 rounded-xl text-left transition active:scale-98 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-extrabold truncate">
                    {sc.shortName}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : isFromAbove
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}
                  >
                    {isFromAbove ? '上から接近' : '下から接近'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* 2. ステップ操作バー + 自動再生ボタン */}
        <div className="bg-[#0f172a] rounded-2xl p-2.5 border border-slate-700/90 space-y-2.5">
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              disabled={stepIndex === 0}
              onClick={() => handleSelectStep(Math.max(0, stepIndex - 1))}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-xs font-bold flex items-center gap-0.5 border border-slate-600 transition"
            >
              <ChevronLeft className="w-4 h-4" />
              前へ
            </button>

            {/* Step 1 - Step 5 Indicator Pills */}
            <div className="flex items-center gap-1">
              {currentScenario.steps.map((st, idx) => {
                const isActive = idx === stepIndex
                return (
                  <button
                    key={st.stepNumber}
                    type="button"
                    onClick={() => handleSelectStep(idx)}
                    className={`w-8 h-8 rounded-xl text-xs font-extrabold transition ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 shadow-sm scale-105'
                        : idx < stepIndex
                        ? 'bg-slate-700 text-slate-200'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    {st.stepNumber}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              disabled={stepIndex === currentScenario.steps.length - 1}
              onClick={() =>
                handleSelectStep(
                  Math.min(currentScenario.steps.length - 1, stepIndex + 1)
                )
              }
              className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-35 text-xs font-extrabold flex items-center gap-0.5 text-white transition"
            >
              次へ
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Step Title & Auto-play Bar */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800 text-xs">
            <div className="font-extrabold text-amber-300 truncate">
              Step {currentStep.stepNumber}: {currentStep.stepTitle}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (stepIndex === currentScenario.steps.length - 1) {
                    setStepIndex(0)
                    setIsAutoPlaying(true)
                  } else {
                    setIsAutoPlaying(!isAutoPlaying)
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition ${
                  isAutoPlaying
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {isAutoPlaying ? (
                  <>
                    <Pause className="w-3 h-3 fill-current" />
                    一時停止
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    自動再生
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSelectStep(0)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                title="Step 1 に戻す"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 3. 診断・アクションコールアウトバナー (または ブラインドクイズ出題パネル) */}
        {shouldHideDiagnosis ? (
          <div className="rounded-2xl p-4 bg-purple-950/70 border-2 border-purple-400/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-400 text-slate-950 text-xs font-extrabold flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                実戦ブラインドクイズ（Step {currentStep.stepNumber}）
              </span>
              <span className="text-xs text-purple-200 font-bold">
                現在値: {currentStep.currentPrice.toLocaleString()}円
              </span>
            </div>

            <p className="text-xs font-bold text-white leading-relaxed">
              下の「板（5,000円VWAP付近の気配変化）」と「歩み値（約定サイズ・売買向き）」を見て、今ここで取るべきベストな行動を選んでください！
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setQuizAnswer('buy')}
                className="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex flex-col items-center gap-1 shadow-md active:scale-95 transition"
              >
                <TrendingUp className="w-4 h-4" />
                買いエントリー
              </button>
              <button
                type="button"
                onClick={() => setQuizAnswer('sell_or_cut')}
                className="py-2.5 px-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex flex-col items-center gap-1 shadow-md active:scale-95 transition"
              >
                <TrendingDown className="w-4 h-4" />
                即損切・空売り
              </button>
              <button
                type="button"
                onClick={() => setQuizAnswer('wait')}
                className="py-2.5 px-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-extrabold flex flex-col items-center gap-1 shadow-md active:scale-95 transition"
              >
                <AlertTriangle className="w-4 h-4 text-amber-300" />
                様子見・待機
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-2xl p-3.5 border transition-all duration-300 space-y-2 ${statusStyles.box}`}
          >
            {/* Quiz Result Feedback Banner if answered */}
            {isBlindQuizMode && quizAnswer !== null && (
              <div
                className={`p-2.5 rounded-xl text-xs font-extrabold flex items-center justify-between ${
                  quizAnswer === currentStep.diagnosis.status
                    ? 'bg-emerald-500/30 border border-emerald-400 text-emerald-100'
                    : 'bg-rose-500/30 border border-rose-400 text-rose-100'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {quizAnswer === currentStep.diagnosis.status
                    ? '🎯 大正解！プロの板読み判断と一致しています！'
                    : '💡 惜しい！下の「板と歩み値の違和感」を確認しましょう'}
                </span>
                {currentStep.stepNumber === 4 && (
                  <span className="text-amber-300 shrink-0 ml-2">
                    Step 5結果: {tickOutcomeFromStep4 >= 0 ? '+' : ''}
                    {tickOutcomeFromStep4}円 (100株で
                    {tickOutcomeFromStep4 >= 0 ? '+' : ''}
                    {(tickOutcomeFromStep4 * 100).toLocaleString()}円)
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs border flex items-center gap-1 ${statusStyles.badge}`}
              >
                <StatusIcon className="w-3.5 h-3.5" />
                {currentStep.diagnosis.badgeText}
              </span>
              <span className="text-xs font-extrabold text-slate-300">
                現在値:{' '}
                <strong className="text-sm text-white">
                  {currentStep.currentPrice.toLocaleString()}円
                </strong>
              </span>
            </div>

            <div className="text-xs font-extrabold text-amber-300 flex items-start gap-1.5">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
              <span>検知された変化：{currentStep.diagnosis.anomalyText}</span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed">
              {currentStep.diagnosis.description}
            </p>
          </div>
        )}

        {/* 4. メイン2カラム画面：左パネル＝板（Order Book） / 右パネル＝歩み値（Time & Sales） */}
        <div
          className={`grid gap-3 ${
            compactSideBySide
              ? 'grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2'
          }`}
        >
          {/* 左パネル：板（Order Book） */}
          <div className="bg-[#0f172a] rounded-2xl p-2.5 border border-slate-700/90">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-extrabold text-slate-200">
                📋 板（気配値 5,004〜4,996円）
              </span>
              <span className="text-[10px] text-amber-300 font-bold">
                基準VWAP: 5,000円
              </span>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-3 text-[10px] font-bold text-slate-400 border-b border-slate-700 pb-1 px-1 text-center">
              <div className="text-left pl-1 text-sky-400">売気配 (Ask)</div>
              <div>価格 (円)</div>
              <div className="text-right pr-1 text-orange-400">買気配 (Bid)</div>
            </div>

            {/* 9 Fixed Price Rows */}
            <div className="divide-y divide-slate-800/80 mt-0.5">
              {currentStep.orderBook.map((row) => {
                const isCurrent = row.price === currentStep.currentPrice
                const isVwap = row.isVwap || row.price === VWAP_PRICE
                const askWidthPct = Math.min(
                  100,
                  Math.round((row.askVolume / MAX_DEPTH_VOLUME) * 100)
                )
                const bidWidthPct = Math.min(
                  100,
                  Math.round((row.bidVolume / MAX_DEPTH_VOLUME) * 100)
                )

                return (
                  <div
                    key={row.price}
                    className={`relative py-1.5 px-1 transition-all duration-300 ${
                      isVwap
                        ? 'bg-amber-500/15 ring-1 ring-inset ring-amber-400/60'
                        : ''
                    } ${
                      isCurrent
                        ? 'ring-2 ring-inset ring-sky-400 bg-sky-500/10'
                        : ''
                    }`}
                  >
                    <div className="grid grid-cols-3 items-center text-xs relative z-10">
                      {/* Ask Volume Column */}
                      <div className="relative h-6 flex items-center justify-start pl-1.5 overflow-hidden rounded-l-md">
                        {row.askVolume > 0 && (
                          <div
                            style={{ width: `${askWidthPct}%` }}
                            className="absolute right-0 top-0 bottom-0 bg-sky-500/25 border-l border-sky-400/50 transition-all duration-300"
                          />
                        )}
                        <span
                          className={`relative z-10 font-mono font-bold ${
                            row.askVolume >= 15000
                              ? 'text-sky-300 font-extrabold'
                              : row.askVolume > 0
                              ? 'text-slate-200'
                              : 'text-slate-600'
                          }`}
                        >
                          {row.askVolume > 0
                            ? row.askVolume.toLocaleString()
                            : ''}
                        </span>
                      </div>

                      {/* Center Price Column */}
                      <div className="flex flex-col items-center justify-center">
                        <div className="flex items-center gap-1">
                          <span
                            className={`font-mono font-extrabold ${
                              isVwap
                                ? 'text-amber-300 text-sm'
                                : isCurrent
                                ? 'text-white'
                                : 'text-slate-300'
                            }`}
                          >
                            {row.price.toLocaleString()}
                          </span>
                          {isVwap && (
                            <span className="px-1 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-black leading-tight">
                              VWAP
                            </span>
                          )}
                        </div>
                        {isCurrent && (
                          <span className="text-[9px] text-sky-300 font-extrabold leading-none">
                            ●現在値
                          </span>
                        )}
                      </div>

                      {/* Bid Volume Column */}
                      <div className="relative h-6 flex items-center justify-end pr-1.5 overflow-hidden rounded-r-md">
                        {row.bidVolume > 0 && (
                          <div
                            style={{ width: `${bidWidthPct}%` }}
                            className="absolute left-0 top-0 bottom-0 bg-orange-500/25 border-r border-orange-400/50 transition-all duration-300"
                          />
                        )}
                        <span
                          className={`relative z-10 font-mono font-bold ${
                            row.bidVolume >= 15000
                              ? 'text-orange-300 font-extrabold'
                              : row.bidVolume > 0
                              ? 'text-slate-200'
                              : 'text-slate-600'
                          }`}
                        >
                          {row.bidVolume > 0
                            ? row.bidVolume.toLocaleString()
                            : ''}
                        </span>
                      </div>
                    </div>

                    {/* Note / Anomaly Badge on the Row */}
                    {row.note && (
                      <div className="mt-1 flex justify-center relative z-10">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getHighlightBadgeStyle(
                            row.highlight
                          )}`}
                        >
                          {row.note}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 右パネル：歩み値（Time & Sales） */}
          <div className="bg-[#0f172a] rounded-2xl p-2.5 border border-slate-700/90 flex flex-col">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-extrabold text-slate-200">
                ⚡ 歩み値（Time & Sales）
              </span>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <span className="text-orange-400">■買(上値叩き)</span>
                <span className="text-sky-400">■売(下値ぶつけ)</span>
              </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-4 text-[10px] font-bold text-slate-400 border-b border-slate-700 pb-1 px-1.5">
              <div>時刻</div>
              <div className="text-right">約定値</div>
              <div className="text-right">出来高</div>
              <div className="text-right">売買向き</div>
            </div>

            {/* Time & Sales Rows */}
            <div className="divide-y divide-slate-800/80 mt-0.5 flex-1">
              {currentStep.timeAndSales.map((ts) => {
                const isBuy = ts.side === 'buy'
                return (
                  <div
                    key={ts.id}
                    className={`grid grid-cols-4 items-center py-2 px-1.5 text-xs transition-all ${
                      ts.isLarge
                        ? isBuy
                          ? 'bg-orange-500/20 font-extrabold ring-1 ring-inset ring-orange-400/50'
                          : 'bg-sky-500/20 font-extrabold ring-1 ring-inset ring-sky-400/50'
                        : ''
                    }`}
                  >
                    <div className="font-mono text-[11px] text-slate-400">
                      {ts.time}
                    </div>

                    <div
                      className={`text-right font-mono font-bold ${
                        ts.price === VWAP_PRICE
                          ? 'text-amber-300'
                          : 'text-slate-100'
                      }`}
                    >
                      {ts.price.toLocaleString()}
                    </div>

                    <div
                      className={`text-right font-mono ${
                        ts.isLarge
                          ? 'text-white font-extrabold'
                          : 'text-slate-200 font-semibold'
                      }`}
                    >
                      {ts.volume.toLocaleString()}
                    </div>

                    <div className="flex items-center justify-end gap-1">
                      {ts.isLarge && (
                        <span className="px-1 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-black flex items-center">
                          <Flame className="w-2.5 h-2.5 fill-current" />
                          大口
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                          isBuy
                            ? 'bg-orange-500/25 text-orange-300 border border-orange-500/40'
                            : 'bg-sky-500/25 text-sky-300 border border-sky-500/40'
                        }`}
                      >
                        {isBuy ? '買' : '売'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Mini Legend at Bottom of Time & Sales */}
            <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div>
                💡 <strong>板と歩み値をセットで見るコツ：</strong>
              </div>
              <p className="leading-relaxed">
                歩み値で<strong>「🔥大口（5,000株以上）」</strong>が約定したのに板が減らない場合は<strong>裏でステルス補充（アイスバーグ）</strong>が入っています。逆に約定していないのに板が消えた場合は<strong>見せ板のキャンセル</strong>です。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
