/**
 * 清空測試資料腳本
 *
 * 刪除：payments、cashHandovers、uploads/receipts/ 照片
 * 保留：households（56 戶）、billingPeriods（期別）、users（帳號）
 *
 * 執行方式：npm run db:clear
 */
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// 直接建立 SQLite 連線（不使用 Drizzle，避免 server 運行中的衝突）
const dbPath = path.join(process.cwd(), 'data', 'ai-cash.db')
const sqlite = new Database(dbPath)

console.log('開始清空測試資料...\n')

// 計算現有資料筆數
const paymentsCount = (sqlite.prepare('SELECT COUNT(*) as c FROM payments').get() as { c: number }).c
const handoversCount = (sqlite.prepare('SELECT COUNT(*) as c FROM cash_handovers').get() as { c: number }).c

console.log(`目前資料：`)
console.log(`  - payments：${paymentsCount} 筆`)
console.log(`  - cash_handovers：${handoversCount} 筆\n`)

// 執行交易，確保一致性
const clear = sqlite.transaction(() => {
  // 刪除所有繳費記錄
  sqlite.prepare('DELETE FROM payments').run()
  console.log(`✓ 已刪除 ${paymentsCount} 筆 payments`)

  // 刪除所有交付記錄
  sqlite.prepare('DELETE FROM cash_handovers').run()
  console.log(`✓ 已刪除 ${handoversCount} 筆 cash_handovers`)

  // 重置 auto-increment 序號，讓新資料從 1 開始（收據編號回到 NO.400001）
  sqlite.prepare(`DELETE FROM sqlite_sequence WHERE name IN ('payments', 'cash_handovers')`).run()
  console.log(`✓ 已重置自增序號`)
})

clear()

// 刪除上傳的收據照片
const uploadsDir = path.join(process.cwd(), 'uploads', 'receipts')
if (fs.existsSync(uploadsDir)) {
  fs.rmSync(uploadsDir, { recursive: true, force: true })
  console.log(`✓ 已刪除 uploads/receipts/ 資料夾`)
} else {
  console.log(`  (uploads/receipts/ 不存在，略過)`)
}

// 確認保留的資料
const householdsCount = (sqlite.prepare('SELECT COUNT(*) as c FROM households').get() as { c: number }).c
const periodsCount = (sqlite.prepare('SELECT COUNT(*) as c FROM billing_periods').get() as { c: number }).c
const usersCount = (sqlite.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c

console.log(`\n保留資料：`)
console.log(`  - households：${householdsCount} 戶`)
console.log(`  - billing_periods：${periodsCount} 期`)
console.log(`  - users：${usersCount} 位`)

sqlite.close()
console.log('\n清空完成！')
