import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { cashHandovers, payments, adhocPayments } from '@/db/schema'
import { and, eq, desc, sql, isNull } from 'drizzle-orm'
import { todayString } from '@/lib/date-utils'
import { calculateDenominationTotal, DENOMINATIONS } from '@/lib/constants'

// 取得交付記錄
export async function GET() {
  const result = await db.select()
    .from(cashHandovers)
    .orderBy(desc(cashHandovers.createdAt))
    .all()
  return NextResponse.json(result)
}

// 建立交付記錄（核心歸零邏輯）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // 計算幣別合計
    const counts: Record<number, number> = {
      2000: body.bill2000 || 0,
      1000: body.bill1000 || 0,
      500: body.bill500 || 0,
      200: body.bill200 || 0,
      100: body.coin100 || 0,
      50: body.coin50 || 0,
      20: body.coin20 || 0,
      10: body.coin10 || 0,
      5: body.coin5 || 0,
      1: body.coin1 || 0,
    }
    const denominationTotal = calculateDenominationTotal(counts)

    // 計算待交付現金總額和筆數（管理費 + 臨時收費合併）
    const regularStats = await db.select({
      totalAmount: sql<number>`COALESCE(SUM(${payments.totalAmount}), 0)`,
      totalCount: sql<number>`COUNT(*)`,
    })
      .from(payments)
      .where(
        and(
          eq(payments.handoverStatus, 'pending'),
          eq(payments.paymentMethod, 'cash')
        )
      )
      .get()

    const adhocStats = await db.select({
      totalAmount: sql<number>`COALESCE(SUM(${adhocPayments.amount}), 0)`,
      totalCount: sql<number>`COUNT(*)`,
    })
      .from(adhocPayments)
      .where(
        and(
          eq(adhocPayments.handoverStatus, 'pending'),
          eq(adhocPayments.paymentMethod, 'cash')
        )
      )
      .get()

    const totalAmount = (regularStats?.totalAmount ?? 0) + (adhocStats?.totalAmount ?? 0)
    const totalCount = (regularStats?.totalCount ?? 0) + (adhocStats?.totalCount ?? 0)

    if (totalAmount === 0) {
      return NextResponse.json({ error: '目前無待交付現金' }, { status: 400 })
    }

    // 建立交付記錄
    const handover = await db.insert(cashHandovers).values({
      periodId: body.periodId,
      handoverDate: todayString(),
      totalCount,
      totalAmount,
      bill2000: body.bill2000 || 0,
      bill1000: body.bill1000 || 0,
      bill500: body.bill500 || 0,
      bill200: body.bill200 || 0,
      coin100: body.coin100 || 0,
      coin50: body.coin50 || 0,
      coin20: body.coin20 || 0,
      coin10: body.coin10 || 0,
      coin5: body.coin5 || 0,
      coin1: body.coin1 || 0,
      denominationTotal,
      receiverName: body.receiverName,
      handoverBy: body.handoverBy,
      note: body.note || null,
    }).returning().get()

    // 將所有待交付的現金 payment 標記為已交付
    await db.update(payments)
      .set({
        handoverStatus: 'handed_over',
        handoverId: handover.id,
      })
      .where(
        and(
          eq(payments.handoverStatus, 'pending'),
          eq(payments.paymentMethod, 'cash')
        )
      )
      .run()

    // 同時標記臨時收費的待交付現金
    await db.update(adhocPayments)
      .set({
        handoverStatus: 'handed_over',
        handoverId: handover.id,
      })
      .where(
        and(
          eq(adhocPayments.handoverStatus, 'pending'),
          eq(adhocPayments.paymentMethod, 'cash')
        )
      )
      .run()

    // 將尚未歸戶的轉帳一併掛到這張簽收單，供簽收單列出轉帳明細。
    // 只綁 handoverId、不動 handoverStatus：轉帳的錢直接進帳戶，
    // 沒有「交付」這件事，狀態文字一律由付款方式決定。
    await db.update(payments)
      .set({ handoverId: handover.id })
      .where(
        and(
          eq(payments.paymentMethod, 'transfer'),
          isNull(payments.handoverId)
        )
      )
      .run()

    await db.update(adhocPayments)
      .set({ handoverId: handover.id })
      .where(
        and(
          eq(adhocPayments.paymentMethod, 'transfer'),
          isNull(adhocPayments.handoverId)
        )
      )
      .run()

    return NextResponse.json(handover, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '交付失敗'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
