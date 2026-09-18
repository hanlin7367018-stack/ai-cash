// 付款狀態的顯示文字
//
// 轉帳的錢直接匯入社區帳戶，沒有「交給主管」這個環節，
// 因此不論是否已歸戶到某張簽收單，一律顯示「已轉帳」。
// 現金才有待交付／已交付的區別。
export function paymentStatusLabel(
  paymentMethod: string,
  handoverStatus: string
): string {
  if (paymentMethod === 'transfer') return '已轉帳'
  return handoverStatus === 'handed_over' ? '已交付' : '待交付'
}

// 對應的 Badge 樣式
export function paymentStatusVariant(
  paymentMethod: string,
  handoverStatus: string
): 'default' | 'secondary' | 'outline' {
  if (paymentMethod === 'transfer') return 'secondary'
  return handoverStatus === 'handed_over' ? 'secondary' : 'outline'
}

// 由收款日期推算所屬的雙月期別（民國年）
// 例：2026-08-19 → 民國 115 年 8 月 → { rocYear: 115, startMonth: 7, endMonth: 8 }
// 與 date-utils.ts 的 getCurrentPeriod() 同一套規則
export function periodOfDate(paymentDate: string): {
  rocYear: number
  startMonth: number
  endMonth: number
  periodName: string
} {
  const d = new Date(paymentDate)
  const rocYear = d.getFullYear() - 1911
  const month = d.getMonth() + 1
  const startMonth = month % 2 === 0 ? month - 1 : month
  const endMonth = startMonth + 1
  return {
    rocYear,
    startMonth,
    endMonth,
    periodName: `${rocYear}年${startMonth}-${endMonth}月`,
  }
}
