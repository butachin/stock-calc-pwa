import React from 'react'
import { Minus, Plus } from 'lucide-react'

interface PresetOption {
  label: string
  value: number
}

interface NumberControlProps {
  label: string
  subLabel?: string
  value: number
  onChange: (val: number) => void
  min: number
  max: number
  step: number
  unit: string
  accentColor?: 'emerald' | 'indigo' | 'amber' | 'rose'
  presets?: PresetOption[]
  allowDecimals?: boolean
}

const ACCENT_MAP = {
  emerald: {
    slider: 'text-emerald-600 accent-emerald-600 bg-emerald-100',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    activePreset: 'bg-emerald-600 text-white border-emerald-600 shadow-xs',
    ring: 'focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20',
  },
  indigo: {
    slider: 'text-indigo-600 accent-indigo-600 bg-indigo-100',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    activePreset: 'bg-indigo-600 text-white border-indigo-600 shadow-xs',
    ring: 'focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20',
  },
  amber: {
    slider: 'text-amber-500 accent-amber-500 bg-amber-100',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    activePreset: 'bg-amber-500 text-white border-amber-500 shadow-xs',
    ring: 'focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20',
  },
  rose: {
    slider: 'text-rose-500 accent-rose-500 bg-rose-100',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    activePreset: 'bg-rose-500 text-white border-rose-500 shadow-xs',
    ring: 'focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20',
  },
}

export const NumberControl: React.FC<NumberControlProps> = ({
  label,
  subLabel,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  accentColor = 'emerald',
  presets,
  allowDecimals = false,
}) => {
  const styles = ACCENT_MAP[accentColor]

  const handleStep = (delta: number) => {
    const next = allowDecimals
      ? Math.round((value + delta) * 100) / 100
      : Math.round(value + delta)
    onChange(Math.max(0, next))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') {
      onChange(0)
      return
    }
    const parsed = allowDecimals ? parseFloat(raw) : parseInt(raw, 10)
    if (!Number.isNaN(parsed)) {
      onChange(Math.max(0, parsed))
    }
  }

  return (
    <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-3.5 transition-all">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <span className="text-sm font-bold text-slate-700">{label}</span>
          {subLabel && (
            <span className="ml-1.5 text-xs text-slate-400 font-medium">{subLabel}</span>
          )}
        </div>

        {/* Stepper + Direct Input */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleStep(-step)}
            className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 active:bg-slate-100 transition"
            aria-label={`${label}を減らす`}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <div
            className={`flex items-baseline bg-white border border-slate-200 rounded-xl px-2.5 py-1 transition ${styles.ring}`}
          >
            <input
              type="number"
              inputMode={allowDecimals ? 'decimal' : 'numeric'}
              value={value === 0 ? '' : value}
              placeholder="0"
              onFocus={(e) => e.target.select()}
              onChange={handleInputChange}
              className="w-20 text-right font-bold text-slate-900 bg-transparent focus:outline-none text-base"
            />
            <span className="ml-1 text-xs font-semibold text-slate-500 select-none">
              {unit}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleStep(step)}
            className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 active:bg-slate-100 transition"
            aria-label={`${label}を増やす`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Smooth Touch Slider */}
      <div className="px-1 py-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          onChange={(e) =>
            onChange(allowDecimals ? parseFloat(e.target.value) : parseInt(e.target.value, 10))
          }
          className={`w-full custom-slider ${styles.slider}`}
        />
      </div>

      {/* Optional Quick Presets */}
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {presets.map((p) => {
            const isSelected = value === p.value
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(p.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition active:scale-95 ${
                  isSelected
                    ? styles.activePreset
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
