import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { adhocProjects, adhocPayments, households } from '@/db/schema'
import { eq, desc, sql } from 'drizzle-orm'

// 取得所有臨時收費專案（含統計）
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status')

  const projects = status
    ? await db.select().from(adhocProjects)
        .where(eq(adhocProjects.status, status as 'open' | 'closed'))
        .orderBy(desc(adhocProjects.createdAt)).all()
    : await db.select().from(adhocProjects)
        .orderBy(desc(adhocProjects.createdAt)).all()

  // 取得啟用住戶總數
  const totalHouseholdsRow = await db.select({ count: sql<number>`COUNT(*)` })
    .from(households).where(eq(households.isActive, true)).get()
  const totalHouseholds = totalHouseholdsRow?.count ?? 0

  // 取得每個專案的已繳戶數
  const paidCounts = await db.select({
    projectId: adhocPayments.projectId,
    count: sql<number>`COUNT(DISTINCT ${adhocPayments.householdId})`,
  }).from(adhocPayments).groupBy(adhocPayments.projectId).all()

  const paidMap = new Map(paidCounts.map((p) => [p.projectId, p.count]))

  const result = projects.map((p) => ({
    ...p,
    totalHouseholds,
    paidCount: paidMap.get(p.id) ?? 0,
    unpaidCount: totalHouseholds - (paidMap.get(p.id) ?? 0),
  }))

  return NextResponse.json(result)
}

// 建立臨時收費專案
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.name || !body.amount || body.amount <= 0) {
      return NextResponse.json({ error: '請填寫專案名稱和金額' }, { status: 400 })
    }

    const result = await db.insert(adhocProjects).values({
      name: body.name,
      amount: body.amount,
      note: body.note || null,
    }).returning().get()

    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '建立失敗'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
