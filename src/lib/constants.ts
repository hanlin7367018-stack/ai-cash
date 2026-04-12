// 幣別面額定義
export const DENOMINATIONS = [
  { value: 2000, label: '2,000元', unit: '張', type: 'bill' as const },
  { value: 1000, label: '1,000元', unit: '張', type: 'bill' as const },
  { value: 500, label: '500元', unit: '張', type: 'bill' as const },
  { value: 200, label: '200元', unit: '張', type: 'bill' as const },
  { value: 100, label: '100元', unit: '個', type: 'coin' as const },
  { value: 50, label: '50元', unit: '個', type: 'coin' as const },
  { value: 20, label: '20元', unit: '個', type: 'coin' as const },
  { value: 10, label: '10元', unit: '個', type: 'coin' as const },
  { value: 5, label: '5元', unit: '個', type: 'coin' as const },
  { value: 1, label: '1元', unit: '個', type: 'coin' as const },
] as const

// 計算幣別盤點總額
export function calculateDenominationTotal(
  counts: Record<number, number>
): number {
  return DENOMINATIONS.reduce(
    (sum, d) => sum + (counts[d.value] || 0) * d.value,
    0
  )
}

// 費用項目定義（primary=true 常態顯示，false 折疊區）
export const FEE_ITEMS = [
  { key: 'managementFee', label: '管理費', dbField: 'management_fee', primary: true },
  { key: 'carParkingFee', label: '汽車位', dbField: 'car_parking_fee', primary: true },
  { key: 'motorParkingFee', label: '機車位', dbField: 'motor_parking_fee', primary: false },
  { key: 'cardFee', label: '刷卡', dbField: 'card_fee', primary: false },
  { key: 'cableTvFee', label: '第四台', dbField: 'cable_tv_fee', primary: false },
  { key: 'sensorFee', label: '感應扣', dbField: 'sensor_fee', primary: false },
] as const

// 棟別列表
export const BUILDINGS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const

// 付款方式
export const PAYMENT_METHODS = [
  { value: 'cash', label: '現金' },
  { value: 'transfer', label: '轉帳' },
] as const
