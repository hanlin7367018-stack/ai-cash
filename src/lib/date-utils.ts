// 西元年轉民國年
export function toROCYear(date: Date): number {
  return date.getFullYear() - 1911
}

// 民國年轉西元年
export function fromROCYear(rocYear: number): number {
  return rocYear + 1911
}

// 格式化民國日期
export function formatROCDate(date: Date): string {
  const rocYear = toROCYear(date)
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${rocYear}年${month}月${day}日`
}

// 取得今日日期字串 (YYYY-MM-DD)
export function todayString(): string {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

// 取得當前應有的期別（雙月）
export function getCurrentPeriod(): { rocYear: number; startMonth: number; endMonth: number } {
  const now = new Date()
  const rocYear = toROCYear(now)
  const month = now.getMonth() + 1
  // 1-2, 3-4, 5-6, 7-8, 9-10, 11-12
  const startMonth = month % 2 === 0 ? month - 1 : month
  const endMonth = startMonth + 1
  return { rocYear, startMonth, endMonth }
}

// 產生期別名稱
export function periodName(rocYear: number, startMonth: number, endMonth: number): string {
  return `${rocYear}年${startMonth}-${endMonth}月`
}

// 格式化金額（加千分位）
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-TW').format(amount)
}
