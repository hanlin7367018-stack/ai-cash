import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { households } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'

// 取得住戶清單
export async function GET(req: NextRequest) {
  const building = req.nextUrl.searchParams.get('building')

  let query = db.select().from(households).where(eq(households.isActive, true))
  if (building) {
    query = db.select().from(households).where(
      and(eq(households.isActive, true), eq(households.building, building))
    )
  }

  const result = await query.orderBy(asc(households.building), asc(households.doorNumber))
  return NextResponse.json(result)
}

// 新增住戶
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = db.insert(households).values({
      unitCode: body.unitCode,
      building: body.building,
      doorNumber: body.doorNumber,
      ownerName: body.ownerName,
      phone: body.phone || null,
      managementFee: body.managementFee,
      carParkingFee: body.carParkingFee || 0,
      motorParkingFee: body.motorParkingFee || 0,
      cardFee: body.cardFee || 0,
      cableTvFee: body.cableTvFee || 0,
      sensorFee: body.sensorFee || 0,
      note: body.note || null,
    }).returning().get()

    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '新增失敗'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
