import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { cashHandovers, payments, households, adhocPayments, adhocProjects } from '@/db/schema'
import { eq } from 'drizzle-orm'

// 取得單筆交付記錄（含 payments + adhocPayments）
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const handoverId = Number(id)

  const handover = db.select()
    .from(cashHandovers)
    .where(eq(cashHandovers.id, handoverId))
    .get()

  if (!handover) {
    return NextResponse.json({ error: '找不到交付記錄' }, { status: 404 })
  }

  // 取得相關的管理費 payments
  const relatedPayments = db.select({
    id: payments.id,
    unitCode: households.unitCode,
    ownerName: households.ownerName,
    totalAmount: payments.totalAmount,
    paymentDate: payments.paymentDate,
    receiptNumber: payments.receiptNumber,
  })
    .from(payments)
    .leftJoin(households, eq(payments.householdId, households.id))
    .where(eq(payments.handoverId, handoverId))
    .all()

  // 取得相關的臨時收費 payments
  const relatedAdhocPayments = db.select({
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
    .where(eq(adhocPayments.handoverId, handoverId))
    .all()

  return NextResponse.json({
    ...handover,
    payments: relatedPayments,
    adhocPayments: relatedAdhocPayments,
  })
}
