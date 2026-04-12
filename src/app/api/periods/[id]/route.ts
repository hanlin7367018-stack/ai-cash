import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { billingPeriods, payments, households } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'

// 取得期別詳情（含統計）
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const periodId = Number(id)

  const period = db.select().from(billingPeriods).where(eq(billingPeriods.id, periodId)).get()
  if (!period) {
    return NextResponse.json({ error: '找不到期別' }, { status: 404 })
  }

  // 總住戶數
  const totalHouseholds = db.select({ count: sql<number>`COUNT(*)` })
    .from(households)
    .where(eq(households.isActive, true))
    .get()?.count ?? 0

  // 已繳戶數
  const paidCount = db.select({ count: sql<number>`COUNT(DISTINCT ${payments.householdId})` })
    .from(payments)
    .where(eq(payments.periodId, periodId))
    .get()?.count ?? 0

  // 已收金額統計
  const stats = db.select({
    totalCollected: sql<number>`COALESCE(SUM(${payments.totalAmount}), 0)`,
    cashAmount: sql<number>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'cash' THEN ${payments.totalAmount} ELSE 0 END), 0)`,
    transferAmount: sql<number>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'transfer' THEN ${payments.totalAmount} ELSE 0 END), 0)`,
    pendingCash: sql<number>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'cash' AND ${payments.handoverStatus} = 'pending' THEN ${payments.totalAmount} ELSE 0 END), 0)`,
  }).from(payments).where(eq(payments.periodId, periodId)).get()

  return NextResponse.json({
    ...period,
    totalHouseholds,
    paidCount,
    unpaidCount: totalHouseholds - paidCount,
    totalCollected: stats?.totalCollected ?? 0,
    cashAmount: stats?.cashAmount ?? 0,
    transferAmount: stats?.transferAmount ?? 0,
    pendingCash: stats?.pendingCash ?? 0,
  })
}

// 更新期別
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const result = db.update(billingPeriods)
    .set({ status: body.status })
    .where(eq(billingPeriods.id, Number(id)))
    .returning().get()

  return NextResponse.json(result)
}
