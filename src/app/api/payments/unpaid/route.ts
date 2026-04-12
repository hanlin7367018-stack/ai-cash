import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { households, payments } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'

// 取得未繳清單
export async function GET(req: NextRequest) {
  const periodId = req.nextUrl.searchParams.get('periodId')
  if (!periodId) {
    return NextResponse.json({ error: '請指定期別' }, { status: 400 })
  }

  // 取得所有啟用中的住戶
  const allHouseholds = db.select()
    .from(households)
    .where(eq(households.isActive, true))
    .orderBy(asc(households.building), asc(households.doorNumber))
    .all()

  // 取得已繳的住戶 ID
  const paidHouseholdIds = db.select({ householdId: payments.householdId })
    .from(payments)
    .where(eq(payments.periodId, Number(periodId)))
    .all()
    .map((p) => p.householdId)

  const paidSet = new Set(paidHouseholdIds)

  // 篩選未繳住戶
  const unpaid = allHouseholds
    .filter((h) => !paidSet.has(h.id))
    .map((h) => ({
      id: h.id,
      unitCode: h.unitCode,
      building: h.building,
      doorNumber: h.doorNumber,
      ownerName: h.ownerName,
      managementFee: h.managementFee,
      carParkingFee: h.carParkingFee,
      motorParkingFee: h.motorParkingFee,
      cardFee: h.cardFee,
      cableTvFee: h.cableTvFee,
      sensorFee: h.sensorFee,
      totalDue: h.managementFee + h.carParkingFee + h.motorParkingFee +
        h.cardFee + h.cableTvFee + h.sensorFee,
    }))

  return NextResponse.json(unpaid)
}
