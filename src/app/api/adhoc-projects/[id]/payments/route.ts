import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { adhocProjects, adhocPayments, households } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'

// 取得該專案的所有繳費記錄
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const projectId = Number(id)

  const records = db.select({
    id: adhocPayments.id,
    householdId: adhocPayments.householdId,
    unitCode: households.unitCode,
    ownerName: households.ownerName,
    amount: adhocPayments.amount,
    paymentMethod: adhocPayments.paymentMethod,
    paymentDate: adhocPayments.paymentDate,
    collectorName: adhocPayments.collectorName,
    handoverStatus: adhocPayments.handoverStatus,
    createdAt: adhocPayments.createdAt,
  })
    .from(adhocPayments)
    .leftJoin(households, eq(adhocPayments.householdId, households.id))
    .where(eq(adhocPayments.projectId, projectId))
    .orderBy(asc(households.building), asc(households.doorNumber))
    .all()

  return NextResponse.json(records)
}

// 批次收款
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const projectId = Number(id)
  const body = await req.json()
  // body: { householdIds: number[], paymentMethod?, paymentDate, collectorName? }

  if (!body.householdIds || body.householdIds.length === 0) {
    return NextResponse.json({ error: '請選擇住戶' }, { status: 400 })
  }

  const project = db.select().from(adhocProjects)
    .where(eq(adhocProjects.id, projectId)).get()

  if (!project) {
    return NextResponse.json({ error: '找不到專案' }, { status: 404 })
  }

  if (project.status !== 'open') {
    return NextResponse.json({ error: '此專案已結案' }, { status: 400 })
  }

  // 過濾掉已繳住戶
  const existingPaidIds = new Set(
    db.select({ householdId: adhocPayments.householdId })
      .from(adhocPayments)
      .where(eq(adhocPayments.projectId, projectId))
      .all()
      .map((p) => p.householdId)
  )

  const newHouseholdIds = (body.householdIds as number[])
    .filter((hid) => !existingPaidIds.has(hid))

  if (newHouseholdIds.length === 0) {
    return NextResponse.json({ error: '所選住戶皆已繳費' }, { status: 400 })
  }

  // 批次新增
  const results: unknown[] = []
  for (const householdId of newHouseholdIds) {
    const result = db.insert(adhocPayments).values({
      projectId,
      householdId,
      amount: project.amount,
      paymentMethod: body.paymentMethod || 'cash',
      paymentDate: body.paymentDate,
      collectorName: body.collectorName || null,
    }).returning().get()
    results.push(result)
  }

  return NextResponse.json({
    count: results.length,
    totalAmount: results.length * project.amount,
  }, { status: 201 })
}
