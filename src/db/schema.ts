import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// 住戶主檔
export const households = sqliteTable('households', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 棟別編號，如 "A-1", "B-3"
  unitCode: text('unit_code').notNull().unique(),
  // 棟別字母
  building: text('building').notNull(),
  // 門號數字
  doorNumber: integer('door_number').notNull(),
  // 住戶姓名
  ownerName: text('owner_name').notNull(),
  // 聯絡電話
  phone: text('phone'),
  // 管理費
  managementFee: integer('management_fee').notNull(),
  // 汽車位費
  carParkingFee: integer('car_parking_fee').notNull().default(0),
  // 機車位費
  motorParkingFee: integer('motor_parking_fee').notNull().default(0),
  // 刷卡費
  cardFee: integer('card_fee').notNull().default(0),
  // 第四台費
  cableTvFee: integer('cable_tv_fee').notNull().default(0),
  // 感應扣費
  sensorFee: integer('sensor_fee').notNull().default(0),
  // 是否啟用
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  // 備註
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now','localtime'))`),
})

// 收費期別（每兩個月一期）
export const billingPeriods = sqliteTable('billing_periods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 民國年
  rocYear: integer('roc_year').notNull(),
  // 起始月
  startMonth: integer('start_month').notNull(),
  // 結束月
  endMonth: integer('end_month').notNull(),
  // 期別名稱，如 "115年1-2月"
  periodName: text('period_name').notNull(),
  // 狀態：open=收費中, closed=已結案
  status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
})

// 繳費記錄
export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 關聯住戶
  householdId: integer('household_id').notNull().references(() => households.id),
  // 關聯期別
  periodId: integer('period_id').notNull().references(() => billingPeriods.id),
  // 收費單編號
  receiptNumber: text('receipt_number').notNull(),
  // 各項費用（獨立記錄，允許臨時調整）
  managementFee: integer('management_fee').notNull().default(0),
  carParkingFee: integer('car_parking_fee').notNull().default(0),
  motorParkingFee: integer('motor_parking_fee').notNull().default(0),
  cardFee: integer('card_fee').notNull().default(0),
  cableTvFee: integer('cable_tv_fee').notNull().default(0),
  sensorFee: integer('sensor_fee').notNull().default(0),
  // 其他費用金額
  otherFee: integer('other_fee').notNull().default(0),
  // 其他費用說明（如「社區活動費」）
  otherFeeNote: text('other_fee_note'),
  // 合計金額
  totalAmount: integer('total_amount').notNull(),
  // 付款方式：cash=現金, transfer=轉帳
  paymentMethod: text('payment_method', { enum: ['cash', 'transfer'] }).notNull().default('cash'),
  // 收款日期
  paymentDate: text('payment_date').notNull(),
  // 收據照片路徑（JSON 陣列）
  receiptPhotos: text('receipt_photos'),
  // 代收款人
  collectorName: text('collector_name'),
  // 交付狀態：pending=待交付, handed_over=已交付
  handoverStatus: text('handover_status', { enum: ['pending', 'handed_over'] }).notNull().default('pending'),
  // 關聯交付批次
  handoverId: integer('handover_id'),
  // 備註
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now','localtime'))`),
})

// 現金交付紀錄
export const cashHandovers = sqliteTable('cash_handovers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 關聯期別
  periodId: integer('period_id').notNull().references(() => billingPeriods.id),
  // 交付日期
  handoverDate: text('handover_date').notNull(),
  // 總筆數
  totalCount: integer('total_count').notNull(),
  // 總金額
  totalAmount: integer('total_amount').notNull(),
  // 各幣別張數/個數
  bill2000: integer('bill_2000').notNull().default(0),
  bill1000: integer('bill_1000').notNull().default(0),
  bill500: integer('bill_500').notNull().default(0),
  bill200: integer('bill_200').notNull().default(0),
  coin100: integer('coin_100').notNull().default(0),
  coin50: integer('coin_50').notNull().default(0),
  coin20: integer('coin_20').notNull().default(0),
  coin10: integer('coin_10').notNull().default(0),
  coin5: integer('coin_5').notNull().default(0),
  coin1: integer('coin_1').notNull().default(0),
  // 幣別合計（用於核對）
  denominationTotal: integer('denomination_total').notNull(),
  // 接收主管
  receiverName: text('receiver_name').notNull(),
  // 交付人
  handoverBy: text('handover_by').notNull(),
  // 備註
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
})

// 臨時收費專案
export const adhocProjects = sqliteTable('adhoc_projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 專案名稱，如「115年第一季機車停車費」、「公共維護費」
  name: text('name').notNull(),
  // 每戶統一金額
  amount: integer('amount').notNull(),
  // 狀態：open=收費中, closed=已結案
  status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
  // 備註說明
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
})

// 臨時收費繳費記錄
export const adhocPayments = sqliteTable('adhoc_payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 關聯專案
  projectId: integer('project_id').notNull().references(() => adhocProjects.id),
  // 關聯住戶
  householdId: integer('household_id').notNull().references(() => households.id),
  // 金額（等於專案設定金額，獨立記錄以防日後修改）
  amount: integer('amount').notNull(),
  // 付款方式：cash=現金, transfer=轉帳
  paymentMethod: text('payment_method', { enum: ['cash', 'transfer'] }).notNull().default('cash'),
  // 收款日期
  paymentDate: text('payment_date').notNull(),
  // 代收款人
  collectorName: text('collector_name'),
  // 交付狀態：pending=待交付, handed_over=已交付
  handoverStatus: text('handover_status', { enum: ['pending', 'handed_over'] }).notNull().default('pending'),
  // 關聯交付批次
  handoverId: integer('handover_id'),
  // 備註
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
})

// 系統使用者
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  // 角色：admin=管理員, collector=代收款人
  role: text('role', { enum: ['admin', 'collector'] }).notNull().default('collector'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
})
