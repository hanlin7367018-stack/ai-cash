import { NextResponse } from 'next/server'
import db from '@/db'
import { payments, adhocPayments } from '@/db/schema'
import { and, eq, sql } from 'drizzle-orm'

// 取得目前手持現金餘額（管理費 + 臨時收費合併）
export async function GET() {
  // 管理費待交付現金
  const regularResult = db.select({
    balance: sql<number>`COALESCE(SUM(${payments.totalAmount}), 0)`,
  })
    .from(payments)
    .where(
      and(
        eq(payments.handoverStatus, 'pending'),
        eq(payments.paymentMethod, 'cash')
      )
    )
    .get()

  // 臨時收費待交付現金
  const adhocResult = db.select({
    balance: sql<number>`COALESCE(SUM(${adhocPayments.amount}), 0)`,
  })
    .from(adhocPayments)
    .where(
      and(
        eq(adhocPayments.handoverStatus, 'pending'),
        eq(adhocPayments.paymentMethod, 'cash')
      )
    )
    .get()

  const regularBalance = regularResult?.balance ?? 0
  const adhocBalance = adhocResult?.balance ?? 0

  return NextResponse.json({
    balance: regularBalance + adhocBalance,
    regularBalance,
    adhocBalance,
  })
}
