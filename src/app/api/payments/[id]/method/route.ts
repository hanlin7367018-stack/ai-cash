import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { payments, households, billingPeriods, cashHandovers } from '@/db/schema'
import { eq } from 'drizzle-orm'

// 取得單筆繳費記錄的更正資訊（含是否鎖定）
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const paymentId = Number(id)

  const row = await db.select({
    id: payments.id,
    unitCode: households.unitCode,
    ownerName: households.ownerName,
    periodName: billingPeriods.periodName,
    receiptNumber: payments.receiptNumber,
    totalAmount: payments.totalAmount,
    paymentMethod: payments.paymentMethod,
    paymentDate: payments.paymentDate,
    handoverId: payments.handoverId,
  })
    .from(payments)
    .leftJoin(households, eq(payments.householdId, households.id))
    .leftJoin(billingPeriods, eq(payments.periodId, billingPeriods.id))
    .where(eq(payments.id, paymentId))
    .get()

  if (!row) {
    return NextResponse.json({ error: '找不到繳費記錄' }, { status: 404 })
  }

  // 已歸戶到簽收單就鎖定，一併帶出交付日期供畫面說明原因
  let handoverDate: string | null = null
  if (row.handoverId !== null) {
    const handover = await db.select({ handoverDate: cashHandovers.handoverDate })
      .from(cashHandovers)
      .where(eq(cashHandovers.id, row.handoverId))
      .get()
    handoverDate = handover?.handoverDate ?? null
  }

  return NextResponse.json({
    kind: 'payment',
    id: row.id,
    unitCode: row.unitCode,
    ownerName: row.ownerName,
    // 「項目」欄：管理費顯示期別
    label: row.periodName?.replace(/月$/, '期') ?? '-',
    receiptNumber: row.receiptNumber,
    totalAmount: row.totalAmount,
    paymentMethod: row.paymentMethod,
    paymentDate: row.paymentDate,
    locked: row.handoverId !== null,
    handoverId: row.handoverId,
    handoverDate,
  })
}

// 更正付款方式（白名單：只變更 paymentMethod 一個欄位）
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const paymentId = Number(id)
    const body = await req.json()
    const paymentMethod = body.paymentMethod

    if (paymentMethod !== 'cash' && paymentMethod !== 'transfer') {
      return NextResponse.json({ error: '付款方式只能是現金或轉帳' }, { status: 400 })
    }

    const payment = await db.select().from(payments)
      .where(eq(payments.id, paymentId)).get()

    if (!payment) {
      return NextResponse.json({ error: '找不到繳費記錄' }, { status: 404 })
    }

    // 已歸戶的記錄不可更正，避免帳面與已列印的簽收單對不上
    if (payment.handoverId !== null) {
      const handover = await db.select({ handoverDate: cashHandovers.handoverDate })
        .from(cashHandovers)
        .where(eq(cashHandovers.id, payment.handoverId))
        .get()
      return NextResponse.json({
        error: `此筆已於 ${handover?.handoverDate ?? '交付日'} 交付（簽收單 #${payment.handoverId}），不可更改付款方式`,
      }, { status: 409 })
    }

    if (payment.paymentMethod === paymentMethod) {
      return NextResponse.json({ error: '付款方式未變更' }, { status: 400 })
    }

    // 其餘欄位（金額、收據編號、照片、日期、備註、期別）一律不動
    const updated = await db.update(payments)
      .set({ paymentMethod })
      .where(eq(payments.id, paymentId))
      .returning().get()

    return NextResponse.json(updated)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '更正失敗'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
