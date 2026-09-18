import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { cashHandovers, payments, households, adhocPayments, adhocProjects, billingPeriods } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

// 取得單筆交付記錄
//
// 轉帳歸戶後同樣帶有 handoverId，因此每組查詢都必須再加上付款方式條件，
// 否則轉帳會混進現金明細，使明細合計與交付總金額對不上。
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const handoverId = Number(id)

  const handover = await db.select()
    .from(cashHandovers)
    .where(eq(cashHandovers.id, handoverId))
    .get()

  if (!handover) {
    return NextResponse.json({ error: '找不到交付記錄' }, { status: 404 })
  }

  // 管理費現金明細（構成交付總金額）
  const relatedPayments = await db.select({
    id: payments.id,
    unitCode: households.unitCode,
    ownerName: households.ownerName,
    totalAmount: payments.totalAmount,
    paymentDate: payments.paymentDate,
    receiptNumber: payments.receiptNumber,
  })
    .from(payments)
    .leftJoin(households, eq(payments.householdId, households.id))
    .where(and(eq(payments.handoverId, handoverId), eq(payments.paymentMethod, 'cash')))
    .all()

  // 臨時收費現金明細
  const relatedAdhocPayments = await db.select({
    id: adhocPayments.id,
    unitCode: households.unitCode,
    ownerName: households.ownerName,
    totalAmount: adhocPayments.amount,
    paymentDate: adhocPayments.paymentDate,
    projectName: adhocProjects.name,
  })
    .from(adhocPayments)
    .leftJoin(households, eq(adhocPayments.householdId, households.id))
    .leftJoin(adhocProjects, eq(adhocPayments.projectId, adhocProjects.id))
    .where(and(eq(adhocPayments.handoverId, handoverId), eq(adhocPayments.paymentMethod, 'cash')))
    .all()

  // 轉帳明細（非現金，不計入交付總金額）
  const transferPayments = await db.select({
    id: payments.id,
    unitCode: households.unitCode,
    ownerName: households.ownerName,
    totalAmount: payments.totalAmount,
    paymentDate: payments.paymentDate,
    receiptNumber: payments.receiptNumber,
    periodName: billingPeriods.periodName,
  })
    .from(payments)
    .leftJoin(households, eq(payments.householdId, households.id))
    .leftJoin(billingPeriods, eq(payments.periodId, billingPeriods.id))
    .where(and(eq(payments.handoverId, handoverId), eq(payments.paymentMethod, 'transfer')))
    .all()

  const transferAdhocPayments = await db.select({
    id: adhocPayments.id,
    unitCode: households.unitCode,
    ownerName: households.ownerName,
    totalAmount: adhocPayments.amount,
    paymentDate: adhocPayments.paymentDate,
    projectName: adhocProjects.name,
  })
    .from(adhocPayments)
    .leftJoin(households, eq(adhocPayments.householdId, households.id))
    .leftJoin(adhocProjects, eq(adhocPayments.projectId, adhocProjects.id))
    .where(and(eq(adhocPayments.handoverId, handoverId), eq(adhocPayments.paymentMethod, 'transfer')))
    .all()

  const transferTotal =
    transferPayments.reduce((s, p) => s + p.totalAmount, 0) +
    transferAdhocPayments.reduce((s, p) => s + p.totalAmount, 0)

  return NextResponse.json({
    ...handover,
    payments: relatedPayments,
    adhocPayments: relatedAdhocPayments,
    transferPayments,
    transferAdhocPayments,
    transferTotal,
    transferCount: transferPayments.length + transferAdhocPayments.length,
  })
}
