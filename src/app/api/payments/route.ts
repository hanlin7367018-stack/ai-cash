import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { payments, households } from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'

// 取得繳費記錄
export async function GET(req: NextRequest) {
  const periodId = req.nextUrl.searchParams.get('periodId')
  const householdId = req.nextUrl.searchParams.get('householdId')
  const limit = req.nextUrl.searchParams.get('limit')

  // 使用 JOIN 取得住戶資訊
  let conditions = []
  if (periodId) conditions.push(eq(payments.periodId, Number(periodId)))
  if (householdId) conditions.push(eq(payments.householdId, Number(householdId)))

  const whereClause = conditions.length > 0
    ? conditions.length === 1 ? conditions[0] : and(...conditions)
    : undefined

  const query = db.select({
    id: payments.id,
    householdId: payments.householdId,
    periodId: payments.periodId,
    receiptNumber: payments.receiptNumber,
    managementFee: payments.managementFee,
    carParkingFee: payments.carParkingFee,
    motorParkingFee: payments.motorParkingFee,
    cardFee: payments.cardFee,
    cableTvFee: payments.cableTvFee,
    sensorFee: payments.sensorFee,
    totalAmount: payments.totalAmount,
    paymentMethod: payments.paymentMethod,
    paymentDate: payments.paymentDate,
    receiptPhotos: payments.receiptPhotos,
    collectorName: payments.collectorName,
    handoverStatus: payments.handoverStatus,
    note: payments.note,
    createdAt: payments.createdAt,
    unitCode: households.unitCode,
    ownerName: households.ownerName,
  })
    .from(payments)
    .leftJoin(households, eq(payments.householdId, households.id))

  if (whereClause) query.where(whereClause)
  query.orderBy(desc(payments.createdAt))
  if (limit) query.limit(Number(limit))

  const result = await query.all()
  return NextResponse.json(result)
}

// 新增繳費記錄
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // 計算合計（含其他費用）
    const totalAmount =
      (body.managementFee || 0) +
      (body.carParkingFee || 0) +
      (body.motorParkingFee || 0) +
      (body.cardFee || 0) +
      (body.cableTvFee || 0) +
      (body.sensorFee || 0) +
      (body.otherFee || 0)

    // 收據編號：前端傳來則使用，否則自動產生
    let receiptNumber = body.receiptNumber?.trim()
    if (!receiptNumber) {
      const lastPayment = await db.select({ receiptNumber: payments.receiptNumber })
        .from(payments)
        .orderBy(desc(payments.id))
        .limit(1)
        .get()

      let nextNumber = 400001
      if (lastPayment?.receiptNumber) {
        const num = parseInt(lastPayment.receiptNumber.replace('NO.', ''))
        if (!isNaN(num)) nextNumber = num + 1
      }
      receiptNumber = `NO.${nextNumber}`
    }

    const result = await db.insert(payments).values({
      householdId: body.householdId,
      periodId: body.periodId,
      receiptNumber,
      managementFee: body.managementFee || 0,
      carParkingFee: body.carParkingFee || 0,
      motorParkingFee: body.motorParkingFee || 0,
      cardFee: body.cardFee || 0,
      cableTvFee: body.cableTvFee || 0,
      sensorFee: body.sensorFee || 0,
      otherFee: body.otherFee || 0,
      otherFeeNote: body.otherFeeNote || null,
      totalAmount,
      paymentMethod: body.paymentMethod || 'cash',
      paymentDate: body.paymentDate,
      collectorName: body.collectorName || null,
      note: body.note || null,
    }).returning().get()

    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '新增失敗'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
