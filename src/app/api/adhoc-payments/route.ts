import { NextResponse } from 'next/server'
import db from '@/db'
import { adhocPayments, adhocProjects, households } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'

// 取得所有臨時收費繳費記錄（跨專案）
//
// 臨時收費沒有期別欄位，期別由收款日期在前端換算，
// 因此這裡一次回傳全部，不做期別篩選。
export async function GET() {
  const result = await db.select({
    id: adhocPayments.id,
    householdId: adhocPayments.householdId,
    unitCode: households.unitCode,
    ownerName: households.ownerName,
    projectId: adhocPayments.projectId,
    projectName: adhocProjects.name,
    totalAmount: adhocPayments.amount,
    paymentMethod: adhocPayments.paymentMethod,
    paymentDate: adhocPayments.paymentDate,
    collectorName: adhocPayments.collectorName,
    handoverStatus: adhocPayments.handoverStatus,
    handoverId: adhocPayments.handoverId,
    createdAt: adhocPayments.createdAt,
  })
    .from(adhocPayments)
    .leftJoin(households, eq(adhocPayments.householdId, households.id))
    .leftJoin(adhocProjects, eq(adhocPayments.projectId, adhocProjects.id))
    .orderBy(desc(adhocPayments.createdAt))
    .all()

  return NextResponse.json(result)
}
