import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { adhocProjects, adhocPayments, households } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

// 取得單一專案詳情（含統計）
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const projectId = Number(id)

  const project = await db.select().from(adhocProjects)
    .where(eq(adhocProjects.id, projectId)).get()

  if (!project) {
    return NextResponse.json({ error: '找不到專案' }, { status: 404 })
  }

  // 啟用住戶總數
  const totalHouseholdsRow = await db.select({ count: sql<number>`COUNT(*)` })
    .from(households).where(eq(households.isActive, true)).get()
  const totalHouseholds = totalHouseholdsRow?.count ?? 0

  // 已繳戶數
  const paidCountRow = await db.select({ count: sql<number>`COUNT(DISTINCT ${adhocPayments.householdId})` })
    .from(adhocPayments).where(eq(adhocPayments.projectId, projectId)).get()
  const paidCount = paidCountRow?.count ?? 0

  // 已繳住戶 ID 清單
  const paidRows = await db.select({ householdId: adhocPayments.householdId })
    .from(adhocPayments).where(eq(adhocPayments.projectId, projectId)).all()
  const paidHouseholdIds = paidRows.map((p) => p.householdId)

  return NextResponse.json({
    ...project,
    totalHouseholds,
    paidCount,
    unpaidCount: totalHouseholds - paidCount,
    paidHouseholdIds,
  })
}

// 更新專案（結案、修改名稱等）
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const projectId = Number(id)
  const body = await req.json()

  const project = await db.select().from(adhocProjects)
    .where(eq(adhocProjects.id, projectId)).get()

  if (!project) {
    return NextResponse.json({ error: '找不到專案' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.status !== undefined) updates.status = body.status
  if (body.note !== undefined) updates.note = body.note

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '無更新內容' }, { status: 400 })
  }

  await db.update(adhocProjects)
    .set(updates)
    .where(eq(adhocProjects.id, projectId))
    .run()

  const updated = await db.select().from(adhocProjects)
    .where(eq(adhocProjects.id, projectId)).get()

  return NextResponse.json(updated)
}
