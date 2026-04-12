/**
 * 清空測試資料腳本
 *
 * 刪除：payments、cashHandovers、adhocPayments、adhocProjects
 * 保留：households（56 戶）、billingPeriods（期別）、users（帳號）
 *
 * 執行方式：npm run db:clear
 */
import { createClient } from '@libsql/client'
import dotenv from 'dotenv'
import path from 'path'

// 載入 .env.local 環境變數
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

async function clearData() {
  console.log('開始清空測試資料...\n')

  // 計算現有資料筆數
  const paymentsCount = (await client.execute('SELECT COUNT(*) as c FROM payments')).rows[0].c
  const handoversCount = (await client.execute('SELECT COUNT(*) as c FROM cash_handovers')).rows[0].c

  console.log(`目前資料：`)
  console.log(`  - payments：${paymentsCount} 筆`)
  console.log(`  - cash_handovers：${handoversCount} 筆\n`)

  // 刪除資料
  await client.execute('DELETE FROM adhoc_payments')
  console.log('已刪除 adhoc_payments')

  await client.execute('DELETE FROM adhoc_projects')
  console.log('已刪除 adhoc_projects')

  await client.execute('DELETE FROM payments')
  console.log(`已刪除 ${paymentsCount} 筆 payments`)

  await client.execute('DELETE FROM cash_handovers')
  console.log(`已刪除 ${handoversCount} 筆 cash_handovers`)

  // 確認保留的資料
  const householdsCount = (await client.execute('SELECT COUNT(*) as c FROM households')).rows[0].c
  const periodsCount = (await client.execute('SELECT COUNT(*) as c FROM billing_periods')).rows[0].c
  const usersCount = (await client.execute('SELECT COUNT(*) as c FROM users')).rows[0].c

  console.log(`\n保留資料：`)
  console.log(`  - households：${householdsCount} 戶`)
  console.log(`  - billing_periods：${periodsCount} 期`)
  console.log(`  - users：${usersCount} 位`)

  console.log('\n清空完成！')
}

clearData().catch(console.error)
