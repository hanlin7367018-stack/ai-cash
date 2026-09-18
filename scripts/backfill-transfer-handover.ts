// 一次性回填：把既有的轉帳記錄歸戶到對應的簽收單
//
// 規則：一筆轉帳歸到「交付日期 >= 付款日期」的最早一張簽收單。
//       付款日落在最後一張簽收單之後的維持未歸戶，等下次交付時處理。
//
// 用法：
//   npx tsx scripts/backfill-transfer-handover.ts                      → dry-run，只印對照表
//   npx tsx scripts/backfill-transfer-handover.ts --apply              → 實際寫入資料庫
//   npx tsx scripts/backfill-transfer-handover.ts --rollback           → dry-run，列出要解除的歸戶
//   npx tsx scripts/backfill-transfer-handover.ts --rollback --apply   → 解除轉帳的歸戶
//
// 回滾用途：新程式碼尚未部署時，舊版簽收單的查詢沒有付款方式條件，
// 會把已歸戶的轉帳混進現金明細。此時先回滾，等部署完成再重跑回填。
// 本腳本為冪等，回填重跑結果一致。
import { createClient } from '@libsql/client'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const APPLY = process.argv.includes('--apply')
const ROLLBACK = process.argv.includes('--rollback')

interface Handover {
  id: number
  handoverDate: string
}

interface TransferRow {
  table: 'payments' | 'adhoc_payments'
  id: number
  unitCode: string
  paymentDate: string
  amount: number
  item: string
}

// 找出該筆轉帳應歸屬的簽收單：交付日期 >= 付款日期的最早一張
function findHandover(handovers: Handover[], paymentDate: string): Handover | null {
  for (const h of handovers) {
    if (h.handoverDate >= paymentDate) return h
  }
  return null
}

// 解除轉帳的歸戶（只動 payment_method='transfer' 的記錄，
// 現金的 handover_id 是交付時正常寫入的，絕不可碰）
async function rollback() {
  const p = await client.execute(
    `SELECT p.id, p.payment_date, p.total_amount AS amt, p.handover_id, h.unit_code
     FROM payments p LEFT JOIN households h ON p.household_id = h.id
     WHERE p.payment_method = 'transfer' AND p.handover_id IS NOT NULL
     ORDER BY p.payment_date`
  )
  const a = await client.execute(
    `SELECT ap.id, ap.payment_date, ap.amount AS amt, ap.handover_id, h.unit_code
     FROM adhoc_payments ap LEFT JOIN households h ON ap.household_id = h.id
     WHERE ap.payment_method = 'transfer' AND ap.handover_id IS NOT NULL
     ORDER BY ap.payment_date`
  )

  // libsql 的 Row 是 array-like，展開後拿不到具名欄位的型別，逐欄取出
  const rows = [
    ...p.rows.map((r) => ({
      table: 'payments' as const,
      amount: Number(r.amt),
      paymentDate: String(r.payment_date),
      unitCode: String(r.unit_code ?? '-'),
      handoverId: Number(r.handover_id),
    })),
    ...a.rows.map((r) => ({
      table: 'adhoc_payments' as const,
      amount: Number(r.amt),
      paymentDate: String(r.payment_date),
      unitCode: String(r.unit_code ?? '-'),
      handoverId: Number(r.handover_id),
    })),
  ]

  console.log(`模式：回滾 ${APPLY ? '（實際寫入）' : '（DRY-RUN，不寫入）'}`)
  if (rows.length === 0) {
    console.log('沒有已歸戶的轉帳記錄，無需回滾。')
    return
  }

  console.log(`\n將解除歸戶的轉帳記錄（${rows.length} 筆）：`)
  let total = 0
  for (const r of rows) {
    const tag = r.table === 'payments' ? '管理費' : '臨時費'
    total += r.amount
    console.log(`  ${tag}  ${r.paymentDate}  ${r.unitCode}  $${r.amount.toLocaleString('zh-TW')}  簽收單 #${r.handoverId} → NULL`)
  }
  console.log(`\n合計 $${total.toLocaleString('zh-TW')}`)

  if (!APPLY) {
    console.log('\nDRY-RUN 結束，未寫入任何資料。確認無誤後加上 --apply 執行。')
    return
  }

  const r1 = await client.execute(
    `UPDATE payments SET handover_id = NULL
     WHERE payment_method = 'transfer' AND handover_id IS NOT NULL`
  )
  const r2 = await client.execute(
    `UPDATE adhoc_payments SET handover_id = NULL
     WHERE payment_method = 'transfer' AND handover_id IS NOT NULL`
  )
  console.log(`\n已解除歸戶：管理費 ${r1.rowsAffected} 筆、臨時收費 ${r2.rowsAffected} 筆。`)
}

async function main() {
  if (ROLLBACK) {
    await rollback()
    return
  }

  const handoverRes = await client.execute(
    `SELECT id, handover_date FROM cash_handovers ORDER BY handover_date ASC`
  )
  const handovers: Handover[] = handoverRes.rows.map((r) => ({
    id: Number(r.id),
    handoverDate: String(r.handover_date),
  }))

  if (handovers.length === 0) {
    console.log('沒有任何簽收單，無法回填。')
    return
  }

  // 尚未歸戶的管理費轉帳
  const pRes = await client.execute(
    `SELECT p.id, p.payment_date, p.total_amount, h.unit_code, b.period_name
     FROM payments p
     LEFT JOIN households h ON p.household_id = h.id
     LEFT JOIN billing_periods b ON p.period_id = b.id
     WHERE p.payment_method = 'transfer' AND p.handover_id IS NULL
     ORDER BY p.payment_date ASC`
  )

  // 尚未歸戶的臨時收費轉帳
  const aRes = await client.execute(
    `SELECT ap.id, ap.payment_date, ap.amount, h.unit_code, pr.name AS project_name
     FROM adhoc_payments ap
     LEFT JOIN households h ON ap.household_id = h.id
     LEFT JOIN adhoc_projects pr ON ap.project_id = pr.id
     WHERE ap.payment_method = 'transfer' AND ap.handover_id IS NULL
     ORDER BY ap.payment_date ASC`
  )

  const rows: TransferRow[] = [
    ...pRes.rows.map((r) => ({
      table: 'payments' as const,
      id: Number(r.id),
      unitCode: String(r.unit_code ?? '-'),
      paymentDate: String(r.payment_date),
      amount: Number(r.total_amount),
      item: String(r.period_name ?? '-').replace(/月$/, '期'),
    })),
    ...aRes.rows.map((r) => ({
      table: 'adhoc_payments' as const,
      id: Number(r.id),
      unitCode: String(r.unit_code ?? '-'),
      paymentDate: String(r.payment_date),
      amount: Number(r.amount),
      item: String(r.project_name ?? '臨時收費'),
    })),
  ].sort((x, y) => x.paymentDate.localeCompare(y.paymentDate))

  if (rows.length === 0) {
    console.log('沒有待回填的轉帳記錄，全部都已歸戶。')
    return
  }

  console.log(`模式：${APPLY ? '實際寫入' : 'DRY-RUN（不寫入）'}`)
  console.log(`簽收單 ${handovers.length} 張，待回填轉帳 ${rows.length} 筆\n`)

  const plan: { row: TransferRow; handover: Handover }[] = []
  const orphans: TransferRow[] = []

  for (const row of rows) {
    const h = findHandover(handovers, row.paymentDate)
    if (h) plan.push({ row, handover: h })
    else orphans.push(row)
  }

  // 依簽收單分組印出
  console.log('【歸戶對照表】')
  const byHandover = new Map<number, { handover: Handover; items: TransferRow[] }>()
  for (const { row, handover } of plan) {
    if (!byHandover.has(handover.id)) {
      byHandover.set(handover.id, { handover, items: [] })
    }
    byHandover.get(handover.id)!.items.push(row)
  }

  for (const [, group] of [...byHandover.entries()].sort((a, b) => a[0] - b[0])) {
    const subtotal = group.items.reduce((s, i) => s + i.amount, 0)
    console.log(`\n  簽收單 #${group.handover.id}（交付日 ${group.handover.handoverDate}）  小計 $${subtotal.toLocaleString('zh-TW')}`)
    for (const i of group.items) {
      const tag = i.table === 'payments' ? '管理費' : '臨時費'
      console.log(`    ${tag}  ${i.paymentDate}  ${i.unitCode}  ${i.item}  $${i.amount.toLocaleString('zh-TW')}`)
    }
  }

  if (orphans.length > 0) {
    console.log(`\n【未歸戶】付款日在最後一張簽收單之後，保持 NULL，等下次交付時處理：`)
    for (const o of orphans) {
      const tag = o.table === 'payments' ? '管理費' : '臨時費'
      console.log(`    ${tag}  ${o.paymentDate}  ${o.unitCode}  ${o.item}  $${o.amount.toLocaleString('zh-TW')}`)
    }
  }

  const total = plan.reduce((s, p) => s + p.row.amount, 0)
  console.log(`\n合計：將回填 ${plan.length} 筆、$${total.toLocaleString('zh-TW')}；未歸戶 ${orphans.length} 筆`)

  if (!APPLY) {
    console.log('\nDRY-RUN 結束，未寫入任何資料。確認無誤後加上 --apply 執行。')
    return
  }

  // 實際寫入：只設定 handover_id，不動 handover_status
  let done = 0
  for (const { row, handover } of plan) {
    await client.execute({
      sql: `UPDATE ${row.table} SET handover_id = ? WHERE id = ? AND handover_id IS NULL`,
      args: [handover.id, row.id],
    })
    done++
  }
  console.log(`\n已寫入 ${done} 筆。`)
}

main().catch((err) => {
  console.error('回填失敗：', err)
  process.exit(1)
})
