import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { adhocPayments, adhocProjects, households, cashHandovers } from '@/db/schema'
import { eq } from 'drizzle-orm'

// 取得單筆臨時收費記錄的更正資訊（含是否鎖定）
// 結構與 /api/payments/[id]/method 對稱，讓前端共用同一個更正視窗
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adhocPaymentId = Number(id)

  const row = await db.select({
    id: adhocPayments.id,
    unitCode: households.unitCode,
    ownerName: households.ownerName,
    projectName: adhocProjects.name,
    amount: adhocPayments.amount,
    paymentMethod: adhocPayments.paymentMethod,
    paymentDate: adhocPayments.paymentDate,
    handoverId: adhocPayments.handoverId,
  })
    .from(adhocPayments)
    .leftJoin(households, eq(adhocPayments.householdId, households.id))
    .leftJoin(adhocProjects, eq(adhocPayments.projectId, adhocProjects.id))
    .where(eq(adhocPayments.id, adhocPaymentId))
    .get()

  if (!row) {
    return NextResponse.json({ error: '找不到繳費記錄' }, { status: 404 })
  }

  let handoverDate: string | null = null
  if (row.handoverId !== null) {
    const handover = await db.select({ handoverDate: cashHandovers.handoverDate })
      .from(cashHandovers)
      .where(eq(cashHandovers.id, row.handoverId))
      .get()
    handoverDate = handover?.handoverDate ?? null
  }

  return NextResponse.json({
    kind: 'adhoc',
    id: row.id,
    unitCode: row.unitCode,
    ownerName: row.ownerName,
    // 「項目」欄：臨時收費顯示專案名稱
    label: row.projectName ?? '臨時收費',
    // 臨時收費沒有收據編號
    receiptNumber: null,
    totalAmount: row.amount,
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
    const adhocPaymentId = Number(id)
    const body = await req.json()
    const paymentMethod = body.paymentMethod

    if (paymentMethod !== 'cash' && paymentMethod !== 'transfer') {
      return NextResponse.json({ error: '付款方式只能是現金或轉帳' }, { status: 400 })
    }

    const payment = await db.select().from(adhocPayments)
      .where(eq(adhocPayments.id, adhocPaymentId)).get()

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

    const updated = await db.update(adhocPayments)
      .set({ paymentMethod })
      .where(eq(adhocPayments.id, adhocPaymentId))
      .returning().get()

    return NextResponse.json(updated)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '更正失敗'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
