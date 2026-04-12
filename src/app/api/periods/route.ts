import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { billingPeriods } from '@/db/schema'
import { desc } from 'drizzle-orm'

// 取得所有期別
export async function GET() {
  const result = db.select().from(billingPeriods)
    .orderBy(desc(billingPeriods.rocYear), desc(billingPeriods.startMonth))
    .all()
  return NextResponse.json(result)
}

// 建立新期別
export async function POST(req: NextRequest) {
  try {
    const { rocYear, startMonth, endMonth } = await req.json()
    const periodName = `${rocYear}年${startMonth}-${endMonth}月`

    const result = db.insert(billingPeriods).values({
      rocYear,
      startMonth,
      endMonth,
      periodName,
    }).returning().get()

    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '建立失敗'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
