import { NextResponse } from 'next/server'
import db from '@/db'
import { households, payments, billingPeriods } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'

// 跨期未繳查詢：彙整所有 open 期別中每戶的未繳狀況
export async function GET() {
  // 1. 取得所有 open 狀態的期別
  const openPeriods = await db.select()
    .from(billingPeriods)
    .where(eq(billingPeriods.status, 'open'))
    .all()

  if (openPeriods.length === 0) {
    return NextResponse.json([])
  }

  // 2. 取得所有啟用中的住戶
  const allHouseholds = await db.select()
    .from(households)
    .where(eq(households.isActive, true))
    .orderBy(asc(households.building), asc(households.doorNumber))
    .all()

  // 3. 取得所有 open 期別的繳費記錄（householdId + periodId）
  const allPayments = await db.select({
    householdId: payments.householdId,
    periodId: payments.periodId,
  })
    .from(payments)
    .all()

  // 建立 Set: "householdId-periodId" 方便查找
  const paidSet = new Set(
    allPayments
      .filter((p) => openPeriods.some((op) => op.id === p.periodId))
      .map((p) => `${p.householdId}-${p.periodId}`)
  )

  // 4. 彙整每戶在哪些期別未繳
  const result = allHouseholds
    .map((h) => {
      const totalDue = h.managementFee + h.carParkingFee + h.motorParkingFee +
        h.cardFee + h.cableTvFee + h.sensorFee

      const unpaidPeriods = openPeriods
        .filter((op) => !paidSet.has(`${h.id}-${op.id}`))
        .map((op) => ({
          periodId: op.id,
          periodName: op.periodName,
          amount: totalDue,
        }))

      if (unpaidPeriods.length === 0) return null

      return {
        id: h.id,
        unitCode: h.unitCode,
        building: h.building,
        ownerName: h.ownerName,
        unpaidPeriods,
        unpaidCount: unpaidPeriods.length,
        totalDue: unpaidPeriods.reduce((sum, p) => sum + p.amount, 0),
      }
    })
    .filter(Boolean)

  return NextResponse.json(result)
}
