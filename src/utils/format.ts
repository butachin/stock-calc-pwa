export function formatNumber(num: number, decimals = 0): string {
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString('ja-JP', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatYen(num: number): string {
  if (!Number.isFinite(num)) return '¥0'
  const rounded = Math.round(num)
  const sign = rounded < 0 ? '-' : ''
  return `${sign}¥${Math.abs(rounded).toLocaleString('ja-JP')}`
}

export function formatSignedYen(num: number): string {
  if (!Number.isFinite(num)) return '±¥0'
  const rounded = Math.round(num)
  if (rounded === 0) return '±¥0'
  const sign = rounded > 0 ? '+' : '-'
  return `${sign}¥${Math.abs(rounded).toLocaleString('ja-JP')}`
}

export function formatManYen(yen: number): string {
  if (!Number.isFinite(yen)) return '0万円'
  const man = yen / 10000
  if (Math.abs(man) >= 10000) {
    const oku = Math.floor(Math.abs(man) / 10000)
    const remMan = Math.round(Math.abs(man) % 10000)
    const sign = yen < 0 ? '-' : ''
    return remMan > 0 ? `${sign}${oku}億${remMan.toLocaleString('ja-JP')}万円` : `${sign}${oku}億円`
  }
  if (Math.abs(man) >= 100) {
    return `${Math.round(man).toLocaleString('ja-JP')}万円`
  }
  return `${man.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万円`
}
