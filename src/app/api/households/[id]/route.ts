import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { households } from '@/db/schema'
import { eq } from 'drizzle-orm'

// 取得單一住戶
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const household = await db.select().from(households).where(eq(households.id, Number(id))).get()
  if (!household) {
    return NextResponse.json({ error: '找不到住戶' }, { status: 404 })
  }
  return NextResponse.json(household)
}

// 更新住戶
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  try {
    const result = await db.update(households)
      .set({
        ownerName: body.ownerName,
        phone: body.phone || null,
        managementFee: body.managementFee,
        carParkingFee: body.carParkingFee ?? 0,
        motorParkingFee: body.motorParkingFee ?? 0,
        cardFee: body.cardFee ?? 0,
        cableTvFee: body.cableTvFee ?? 0,
        sensorFee: body.sensorFee ?? 0,
        note: body.note || null,
      })
      .where(eq(households.id, Number(id)))
      .returning().get()

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '更新失敗'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// 軟刪除住戶
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await db.update(households)
    .set({ isActive: false })
    .where(eq(households.id, Number(id)))
    .run()

  return NextResponse.json({ success: true })
}
