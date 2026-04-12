import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { payments, households } from '@/db/schema'
import { eq } from 'drizzle-orm'

// 取得單筆繳費記錄
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = db.select({
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
    unitCode: households.unitCode,
    ownerName: households.ownerName,
  })
    .from(payments)
    .leftJoin(households, eq(payments.householdId, households.id))
    .where(eq(payments.id, Number(id)))
    .get()

  if (!result) {
    return NextResponse.json({ error: '找不到記錄' }, { status: 404 })
  }
  return NextResponse.json(result)
}

// 更新繳費記錄
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const totalAmount =
    (body.managementFee || 0) +
    (body.carParkingFee || 0) +
    (body.motorParkingFee || 0) +
    (body.cardFee || 0) +
    (body.cableTvFee || 0) +
    (body.sensorFee || 0)

  const result = db.update(payments)
    .set({ ...body, totalAmount })
    .where(eq(payments.id, Number(id)))
    .returning().get()

  return NextResponse.json(result)
}

// 刪除繳費記錄
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  db.delete(payments).where(eq(payments.id, Number(id))).run()
  return NextResponse.json({ success: true })
}
