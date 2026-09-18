import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { cashHandovers, payments, households, billingPeriods, adhocPayments, adhocProjects } from '@/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import ExcelJS from 'exceljs'

// 匯出 Excel
// GET /api/reports/export-excel?type=handover&id=1
// GET /api/reports/export-excel?type=unpaid&periodId=1
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')
  const id = req.nextUrl.searchParams.get('id')
  const periodId = req.nextUrl.searchParams.get('periodId')

  if (type === 'handover' && id) {
    return exportHandover(Number(id))
  }
  if (type === 'unpaid' && periodId) {
    return exportUnpaid(Number(periodId))
  }

  return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
}

// 匯出交付簽收單
async function exportHandover(handoverId: number) {
  const handover = await db.select()
    .from(cashHandovers)
    .where(eq(cashHandovers.id, handoverId))
    .get()

  if (!handover) {
    return NextResponse.json({ error: '找不到交付記錄' }, { status: 404 })
  }

  // 取得期別名稱
  const period = await db.select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, handover.periodId))
    .get()

  // 取得收款明細
  const relatedPayments = await db.select({
    unitCode: households.unitCode,
    ownerName: households.ownerName,
    totalAmount: payments.totalAmount,
    paymentDate: payments.paymentDate,
    receiptNumber: payments.receiptNumber,
  })
    .from(payments)
    .leftJoin(households, eq(payments.householdId, households.id))
    // 轉帳歸戶後同樣帶 handoverId，須加付款方式條件，否則會混進現金明細
    .where(and(eq(payments.handoverId, handoverId), eq(payments.paymentMethod, 'cash')))
    .all()

  // 轉帳明細（非現金，不計入交付總金額）
  const transferRows = await db.select({
    unitCode: households.unitCode,
    ownerName: households.ownerName,
    amount: payments.totalAmount,
    paymentDate: payments.paymentDate,
    receiptNumber: payments.receiptNumber,
    periodName: billingPeriods.periodName,
  })
    .from(payments)
    .leftJoin(households, eq(payments.householdId, households.id))
    .leftJoin(billingPeriods, eq(payments.periodId, billingPeriods.id))
    .where(and(eq(payments.handoverId, handoverId), eq(payments.paymentMethod, 'transfer')))
    .all()

  const transferAdhocRows = await db.select({
    unitCode: households.unitCode,
    ownerName: households.ownerName,
    amount: adhocPayments.amount,
    paymentDate: adhocPayments.paymentDate,
    projectName: adhocProjects.name,
  })
    .from(adhocPayments)
    .leftJoin(households, eq(adhocPayments.householdId, households.id))
    .leftJoin(adhocProjects, eq(adhocPayments.projectId, adhocProjects.id))
    .where(and(eq(adhocPayments.handoverId, handoverId), eq(adhocPayments.paymentMethod, 'transfer')))
    .all()

  // 合併：管理費的「項目」是期別、臨時收費的「項目」是專案名稱
  const transfers = [
    ...transferRows.map((r) => ({
      unitCode: r.unitCode,
      ownerName: r.ownerName,
      item: r.periodName?.replace(/月$/, '期').replace(/^\d+年/, '') ?? '-',
      receiptNumber: r.receiptNumber as string | null,
      amount: r.amount,
      paymentDate: r.paymentDate,
    })),
    ...transferAdhocRows.map((r) => ({
      unitCode: r.unitCode,
      ownerName: r.ownerName,
      item: r.projectName ?? '臨時收費',
      receiptNumber: null as string | null,
      amount: r.amount,
      paymentDate: r.paymentDate,
    })),
  ].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))

  const transferTotal = transfers.reduce((s, t) => s + t.amount, 0)

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('交付簽收單')

  // 標題
  ws.mergeCells('A1:F1')
  const titleCell = ws.getCell('A1')
  titleCell.value = '社區管理委員會 現金交付簽收單'
  titleCell.font = { bold: true, size: 16 }
  titleCell.alignment = { horizontal: 'center' }

  // 摘要資訊
  ws.addRow([])
  ws.addRow(['期別', period?.periodName?.replace(/月$/, '期') ?? '-'])
  ws.addRow(['交付日期', handover.handoverDate])
  ws.addRow(['交付人', handover.handoverBy])
  ws.addRow(['接收主管', handover.receiverName])
  ws.addRow(['總筆數', handover.totalCount])
  ws.addRow(['總金額', handover.totalAmount])
  if (transfers.length > 0) {
    ws.addRow(['同期轉帳', `$${transferTotal.toLocaleString('zh-TW')}（${transfers.length} 筆・未含在交付現金內）`])
  }
  ws.addRow([])

  // 幣別盤點
  ws.addRow(['【幣別盤點】'])
  ws.addRow(['面額', '數量', '小計'])
  const denomData = [
    { label: '2,000元', count: handover.bill2000, value: 2000 },
    { label: '1,000元', count: handover.bill1000, value: 1000 },
    { label: '500元', count: handover.bill500, value: 500 },
    { label: '200元', count: handover.bill200, value: 200 },
    { label: '100元', count: handover.coin100, value: 100 },
    { label: '50元', count: handover.coin50, value: 50 },
    { label: '20元', count: handover.coin20, value: 20 },
    { label: '10元', count: handover.coin10, value: 10 },
    { label: '5元', count: handover.coin5, value: 5 },
    { label: '1元', count: handover.coin1, value: 1 },
  ].filter(d => d.count > 0)

  for (const d of denomData) {
    ws.addRow([d.label, d.count, d.count * d.value])
  }
  ws.addRow(['合計', '', handover.denominationTotal])
  ws.addRow([])

  // 收款明細
  ws.addRow(['【收款明細】'])
  ws.addRow(['序號', '棟號', '住戶', '收據編號', '金額', '日期'])
  relatedPayments.forEach((p, i) => {
    ws.addRow([i + 1, p.unitCode, p.ownerName, p.receiptNumber, p.totalAmount, p.paymentDate])
  })
  ws.addRow(['', '', '', '合計', relatedPayments.reduce((s, p) => s + p.totalAmount, 0), ''])
  ws.addRow([])

  // 臨時收費明細
  const relatedAdhoc = await db.select({
    unitCode: households.unitCode,
    ownerName: households.ownerName,
    amount: adhocPayments.amount,
    paymentDate: adhocPayments.paymentDate,
    projectName: adhocProjects.name,
  })
    .from(adhocPayments)
    .leftJoin(households, eq(adhocPayments.householdId, households.id))
    .leftJoin(adhocProjects, eq(adhocPayments.projectId, adhocProjects.id))
    .where(and(eq(adhocPayments.handoverId, handoverId), eq(adhocPayments.paymentMethod, 'cash')))
    .all()

  if (relatedAdhoc.length > 0) {
    ws.addRow(['【臨時收費明細】'])
    ws.addRow(['序號', '棟號', '住戶', '收費專案', '金額', '日期'])
    relatedAdhoc.forEach((p, i) => {
      ws.addRow([i + 1, p.unitCode, p.ownerName, p.projectName, p.amount, p.paymentDate])
    })
    ws.addRow(['', '', '', '合計', relatedAdhoc.reduce((s, p) => s + p.amount, 0), ''])
    ws.addRow([])
  }

  if (transfers.length > 0) {
    ws.addRow(['【轉帳明細（非現金）】'])
    ws.addRow(['序號', '棟號', '住戶', '項目', '收據編號', '金額', '狀態', '日期'])
    transfers.forEach((t, i) => {
      ws.addRow([i + 1, t.unitCode, t.ownerName, t.item, t.receiptNumber ?? '－', t.amount, '已轉帳', t.paymentDate])
    })
    ws.addRow(['', '', '', '', '轉帳小計', transferTotal, '', ''])
    ws.addRow(['※ 轉帳款項已直接匯入社區帳戶，不含在本次交付現金內，僅供核對。'])
    ws.addRow([])
  }

  // 簽名欄
  ws.addRow([])
  ws.addRow(['交付人簽名：＿＿＿＿＿＿＿＿', '', '', '接收主管簽名：＿＿＿＿＿＿＿＿'])

  // 欄寬
  ws.columns = [
    { width: 15 }, { width: 10 }, { width: 12 },
    { width: 15 }, { width: 12 }, { width: 15 },
  ]

  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="handover-${handoverId}.xlsx"`,
    },
  })
}

// 匯出未繳清單
async function exportUnpaid(periodIdNum: number) {
  const period = await db.select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, periodIdNum))
    .get()

  // 所有啟用住戶
  const allHouseholds = await db.select()
    .from(households)
    .where(eq(households.isActive, true))
    .orderBy(asc(households.building), asc(households.doorNumber))
    .all()

  // 已繳住戶 ID
  const paidRows = await db.select({ householdId: payments.householdId })
    .from(payments)
    .where(eq(payments.periodId, periodIdNum))
    .all()
  const paidIds = new Set(paidRows.map((p) => p.householdId))

  const unpaid = allHouseholds.filter((h) => !paidIds.has(h.id))

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('未繳清單')

  // 標題
  ws.mergeCells('A1:E1')
  const titleCell = ws.getCell('A1')
  titleCell.value = `${period?.periodName?.replace(/月$/, '期') ?? ''} 未繳清單`
  titleCell.font = { bold: true, size: 16 }
  titleCell.alignment = { horizontal: 'center' }

  ws.addRow([])
  ws.addRow(['棟號', '姓名', '管理費', '停車費', '應繳'])
  for (const h of unpaid) {
    const total = h.managementFee + h.carParkingFee + h.motorParkingFee +
      h.cardFee + h.cableTvFee + h.sensorFee
    ws.addRow([h.unitCode, h.ownerName, h.managementFee, h.carParkingFee, total])
  }
  const totalDue = unpaid.reduce((s, h) =>
    s + h.managementFee + h.carParkingFee + h.motorParkingFee +
    h.cardFee + h.cableTvFee + h.sensorFee, 0)
  ws.addRow(['', '合計', '', '', totalDue])

  ws.columns = [
    { width: 10 }, { width: 12 }, { width: 10 },
    { width: 10 }, { width: 12 },
  ]

  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="unpaid-${periodIdNum}.xlsx"`,
    },
  })
}
