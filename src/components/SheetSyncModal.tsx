import React, { useState } from 'react'
import {
  Check,
  Cloud,
  CloudDownload,
  CloudUpload,
  Copy,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  X,
} from 'lucide-react'
import { useStockStore } from '../store/useStockStore'
import gasCodeRaw from '../../gas/Code.gs?raw'

interface SheetSyncModalProps {
  onClose: () => void
}

export const SheetSyncModal: React.FC<SheetSyncModalProps> = ({ onClose }) => {
  const {
    gasUrl,
    syncPasscode,
    autoSync,
    lastSyncedAt,
    isSyncing,
    setSyncConfig,
    pushToSheet,
    pullFromSheet,
    showToast,
  } = useStockStore()

  const [showSetupGuide, setShowSetupGuide] = useState(!gasUrl)
  const [copied, setCopied] = useState(false)

  const handleCopyGasCode = async () => {
    try {
      await navigator.clipboard.writeText(gasCodeRaw)
      setCopied(true)
      showToast('GASスクリプトをクリップボードにコピーしました！')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      showToast('コピーに失敗しました。gas/Code.gs を参照してください')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Googleスプレッドシート連携
              </h2>
              <p className="text-[11px] text-slate-500">
                完全無料・サーバー代0円でデータをクラウド保存＆共有
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Bar */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                gasUrl ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            />
            <span className="font-bold text-slate-700">
              {gasUrl ? 'スプレッドシート接続設定済み' : '未設定（スマホ本体のみ保存）'}
            </span>
          </div>
          {lastSyncedAt && (
            <span className="text-[11px] text-slate-400">
              最終同期: {lastSyncedAt}
            </span>
          )}
        </div>

        {/* URL & Passcode Inputs */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              GAS ウェブアプリのURL
            </label>
            <input
              type="url"
              value={gasUrl}
              onChange={(e) => setSyncConfig({ gasUrl: e.target.value })}
              placeholder="https://script.google.com/macros/s/xxxxx/exec"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 items-center">
            <div>
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 mb-1">
                <KeyRound className="w-3 h-3 text-slate-400" />
                合言葉（任意）
              </label>
              <input
                type="password"
                value={syncPasscode}
                onChange={(e) => setSyncConfig({ syncPasscode: e.target.value })}
                placeholder="未設定なら空欄でOK"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-4">
              <label className="flex items-center gap-2 cursor-pointer select-none bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3 py-2">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setSyncConfig({ autoSync: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-emerald-900">
                  変更時に自動保存
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Manual Sync Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            disabled={isSyncing || !gasUrl}
            onClick={() => pushToSheet(false)}
            className="py-3 px-3 rounded-2xl bg-emerald-600 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CloudUpload className="w-4 h-4" />
            )}
            シートへ保存（書込）
          </button>

          <button
            type="button"
            disabled={isSyncing || !gasUrl}
            onClick={() => pullFromSheet()}
            className="py-3 px-3 rounded-2xl bg-indigo-600 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CloudDownload className="w-4 h-4" />
            )}
            シートから読込（同期）
          </button>
        </div>

        {/* Setup Guide Accordion */}
        <div className="border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={() => setShowSetupGuide(!showSetupGuide)}
            className="w-full flex items-center justify-between text-xs font-extrabold text-slate-700 py-1"
          >
            <span className="flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-emerald-600" />
              3分でできる！Googleスプレッドシート連携の作り方
            </span>
            <span className="text-emerald-600">
              {showSetupGuide ? '閉じる ▲' : '手順を見る ▼'}
            </span>
          </button>

          {showSetupGuide && (
            <div className="mt-2.5 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-700 space-y-2.5 leading-relaxed">
              <ol className="list-decimal list-inside space-y-2">
                <li>
                  Googleスプレッドシートで<strong>新規シート</strong>を作ります（シート名や見出しは自動作成されるので空っぽでOK！）。
                </li>
                <li>
                  上部メニューの<strong>「拡張機能」＞「Apps Script」</strong>を開きます。
                </li>
                <li>
                  下のボタンで<strong>専用スクリプトをコピー</strong>して、Apps Script に貼り付けて保存（💾）します。
                </li>
                <li>
                  右上の<strong>「デプロイ」＞「新しいデプロイ」</strong>を押し、種類「<strong>ウェブアプリ</strong>」、アクセスできるユーザーを「<strong>全員</strong>」にしてデプロイします。
                </li>
                <li>
                  発行されたURL（<code>https://script.google.com/.../exec</code>）を上の欄に貼り付ければ完了です！
                </li>
              </ol>

              <button
                type="button"
                onClick={handleCopyGasCode}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-98 transition"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    コピーしました！Apps Scriptに貼り付けてください
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-emerald-400" />
                    貼り付け用GASスクリプトをコピーする
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
