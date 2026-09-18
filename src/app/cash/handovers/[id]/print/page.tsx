import { notFound } from "next/navigation"
import db from "@/db"
import {
  cashHandovers,
  payments,
  households,
  billingPeriods,
  adhocPayments,
  adhocProjects,
} from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { formatCurrency, formatROCDate } from "@/lib/date-utils"
import { DENOMINATIONS } from "@/lib/constants"
import { PrintTrigger } from "./print-trigger"

export const dynamic = "force-dynamic"

// 伺服器端取得單筆交付完整資料
async function getHandoverData(id: number) {
  const handover = await db
    .select()
    .from(cashHandovers)
    .where(eq(cashHandovers.id, id))
    .get()

  if (!handover) return null

  const period = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, handover.periodId))
    .get()

  const relatedPayments = await db
    .select({
      id: payments.id,
      unitCode: households.unitCode,
      ownerName: households.ownerName,
      totalAmount: payments.totalAmount,
      paymentDate: payments.paymentDate,
      receiptNumber: payments.receiptNumber,
      periodId: payments.periodId,
      periodName: billingPeriods.periodName,
    })
    .from(payments)
    .leftJoin(households, eq(payments.householdId, households.id))
    .leftJoin(billingPeriods, eq(payments.periodId, billingPeriods.id))
    .where(and(eq(payments.handoverId, id), eq(payments.paymentMethod, "cash")))
    .all()

  // 臨時收費明細
  const relatedAdhocPayments = await db
    .select({
      id: adhocPayments.id,
      unitCode: households.unitCode,
      ownerName: households.ownerName,
      amount: adhocPayments.amount,
      paymentDate: adhocPayments.paymentDate,
      projectName: adhocProjects.name,
    })
    .from(adhocPayments)
    .leftJoin(households, eq(adhocPayments.householdId, households.id))
    .leftJoin(adhocProjects, eq(adhocPayments.projectId, adhocProjects.id))
    .where(and(eq(adhocPayments.handoverId, id), eq(adhocPayments.paymentMethod, "cash")))
    .all()

  // 轉帳明細（非現金）：管理費與臨時收費合併為一張表，以「項目」欄區分來源
  const transferRows = await db
    .select({
      id: payments.id,
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
    .where(and(eq(payments.handoverId, id), eq(payments.paymentMethod, "transfer")))
    .all()

  const transferAdhocRows = await db
    .select({
      id: adhocPayments.id,
      unitCode: households.unitCode,
      ownerName: households.ownerName,
      amount: adhocPayments.amount,
      paymentDate: adhocPayments.paymentDate,
      projectName: adhocProjects.name,
    })
    .from(adhocPayments)
    .leftJoin(households, eq(adhocPayments.householdId, households.id))
    .leftJoin(adhocProjects, eq(adhocPayments.projectId, adhocProjects.id))
    .where(and(eq(adhocPayments.handoverId, id), eq(adhocPayments.paymentMethod, "transfer")))
    .all()

  // 合併成統一結構，管理費的「項目」是期別、臨時收費的「項目」是專案名稱
  const transfers = [
    ...transferRows.map((r) => ({
      key: `p-${r.id}`,
      unitCode: r.unitCode,
      ownerName: r.ownerName,
      item: shortPeriodLabel(r.periodName),
      receiptNumber: r.receiptNumber as string | null,
      amount: r.amount,
      paymentDate: r.paymentDate,
    })),
    ...transferAdhocRows.map((r) => ({
      key: `a-${r.id}`,
      unitCode: r.unitCode,
      ownerName: r.ownerName,
      item: r.projectName ?? "臨時收費",
      receiptNumber: null as string | null,
      amount: r.amount,
      paymentDate: r.paymentDate,
    })),
  ].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))

  return {
    handover,
    period,
    payments: relatedPayments,
    adhocPayments: relatedAdhocPayments,
    transfers,
  }
}

// DB 內 periodName 存成「115年1-2月」；顯示層統一將「月」替換為「期」
// 以符合實際口語慣例（例：「1-2期」、「3-4期」）
function toPeriodTerm(periodName: string): string {
  return periodName.replace(/月$/, "期")
}

// 將完整期別名稱去除「XXX年」前綴，例如「115年1-2月」→「1-2期」
function shortPeriodLabel(periodName: string | null): string {
  if (!periodName) return "-"
  return toPeriodTerm(periodName).replace(/^\d+年/, "")
}

// 組合多個期別的顯示文字
// 單期：「115年3-4期」
// 同年多期：「115年1-2期、3-4期（混合）」
// 跨年多期：「114年11-12期、115年1-2期（混合）」
function formatMixedPeriods(periodNames: string[]): string {
  if (periodNames.length === 0) return "-"

  // 統一將「月」替換為「期」
  const normalized = periodNames.map(toPeriodTerm)
  if (normalized.length === 1) return normalized[0]

  // 嘗試提取共同年份前綴
  const yearMatch = normalized[0].match(/^(\d+年)/)
  if (yearMatch) {
    const year = yearMatch[1]
    const allSameYear = normalized.every((n) => n.startsWith(year))
    if (allSameYear) {
      const monthParts = normalized.map((n) => n.replace(year, ""))
      return `${year}${monthParts.join("、")}（混合）`
    }
  }
  return `${normalized.join("、")}（混合）`
}

export default async function HandoverPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const handoverId = Number(id)
  if (!Number.isInteger(handoverId) || handoverId <= 0) notFound()

  const data = await getHandoverData(handoverId)
  if (!data) notFound()

  const { handover, period, payments: list, adhocPayments: adhocList, transfers } = data

  // 轉帳款項不計入交付現金總額，僅供核對
  const transferTotal = transfers.reduce((s, t) => s + t.amount, 0)

  // 收集本批次涵蓋的所有期別（去重複，保持原順序）
  const uniquePeriodNames: string[] = []
  const seenPeriodIds = new Set<number>()
  for (const p of list) {
    if (p.periodId != null && !seenPeriodIds.has(p.periodId) && p.periodName) {
      seenPeriodIds.add(p.periodId)
      uniquePeriodNames.push(p.periodName)
    }
  }
  // 表頭顯示文字：跨期時自動標註「（混合）」
  // 透過 formatMixedPeriods 統一處理「月」→「期」轉換
  const displayPeriodName =
    uniquePeriodNames.length > 0
      ? formatMixedPeriods(uniquePeriodNames)
      : period?.periodName
        ? formatMixedPeriods([period.periodName])
        : "-"
  // 是否跨期（決定明細表是否顯示「期別」欄）
  const isMixedPeriod = uniquePeriodNames.length > 1

  // 幣別對應資料
  const denominationCounts: Record<number, number> = {
    2000: handover.bill2000,
    1000: handover.bill1000,
    500: handover.bill500,
    200: handover.bill200,
    100: handover.coin100,
    50: handover.coin50,
    20: handover.coin20,
    10: handover.coin10,
    5: handover.coin5,
    1: handover.coin1,
  }

  // 差額（幣別合計 - 現金總額）
  const difference = handover.denominationTotal - handover.totalAmount

  // 列印時間
  const now = new Date()
  const printTime = `${formatROCDate(now)} ${now
    .getHours()
    .toString()
    .padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`

  return (
    <>
      <PrintTrigger />
      <div className="print-root">
        {/* 操作列（列印時隱藏） */}
        <div className="no-print toolbar">
          <button id="printBtn" type="button" className="btn-print">
            列印 / 另存為 PDF
          </button>
          <a href="/cash" className="btn-back">
            返回
          </a>
          <span className="tip">
            提示：點擊列印後，在對話框中選擇「另存為 PDF」即可下載簽收單
          </span>
        </div>

        {/* 簽收單內容 */}
        <div className="sheet">
          <h1 className="title">社區管理委員會</h1>
          <h2 className="subtitle">現金交付簽收單</h2>

          <table className="meta">
            <tbody>
              <tr>
                <th>收費期別</th>
                <td>{displayPeriodName}</td>
                <th>交付日期</th>
                <td>
                  {formatROCDate(
                    new Date(handover.handoverDate.replace(/-/g, "/"))
                  )}
                </td>
              </tr>
              <tr>
                <th>交付人</th>
                <td>{handover.handoverBy}</td>
                <th>接收主管</th>
                <td>{handover.receiverName}</td>
              </tr>
              {transfers.length > 0 ? (
                <tr>
                  <th>同期轉帳</th>
                  <td colSpan={3}>
                    ${formatCurrency(transferTotal)}（{transfers.length} 筆・未含在交付現金內）
                  </td>
                </tr>
              ) : null}
              {handover.note ? (
                <tr>
                  <th>備註</th>
                  <td colSpan={3}>{handover.note}</td>
                </tr>
              ) : null}
            </tbody>
          </table>

          {/* 幣別盤點 */}
          <h3 className="section">幣別盤點</h3>
          <table className="denom">
            <thead>
              <tr>
                <th>面額</th>
                <th>單位</th>
                <th>張 / 個數</th>
                <th>小計</th>
              </tr>
            </thead>
            <tbody>
              {DENOMINATIONS.map((d) => {
                const count = denominationCounts[d.value] || 0
                const subtotal = count * d.value
                return (
                  <tr key={d.value}>
                    <td className="num">${formatCurrency(d.value)}</td>
                    <td className="center">{d.unit}</td>
                    <td className="center">{count}</td>
                    <td className="num">
                      {subtotal > 0 ? `$${formatCurrency(subtotal)}` : "-"}
                    </td>
                  </tr>
                )
              })}
              <tr className="total">
                <td colSpan={3} className="right">
                  幣別合計
                </td>
                <td className="num">
                  ${formatCurrency(handover.denominationTotal)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 收款明細 */}
          <h3 className="section">收款明細</h3>
          {list.length === 0 ? (
            <p className="empty">（本批次無繳費記錄）</p>
          ) : (
            <table className="payments">
              <thead>
                <tr>
                  <th style={{ width: isMixedPeriod ? "7%" : "8%" }}>序號</th>
                  <th style={{ width: isMixedPeriod ? "11%" : "15%" }}>棟別</th>
                  {isMixedPeriod && (
                    <th style={{ width: "13%" }}>期別</th>
                  )}
                  <th style={{ width: isMixedPeriod ? "16%" : "20%" }}>住戶</th>
                  <th style={{ width: isMixedPeriod ? "19%" : "22%" }}>收據編號</th>
                  <th style={{ width: isMixedPeriod ? "14%" : "15%" }}>金額</th>
                  <th style={{ width: isMixedPeriod ? "20%" : "20%" }}>日期</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p, i) => (
                  <tr key={p.id}>
                    <td className="center">{i + 1}</td>
                    <td className="center">{p.unitCode ?? "-"}</td>
                    {isMixedPeriod && (
                      <td className="center">
                        {shortPeriodLabel(p.periodName)}
                      </td>
                    )}
                    <td>{p.ownerName ?? "-"}</td>
                    <td className="center">{p.receiptNumber}</td>
                    <td className="num">${formatCurrency(p.totalAmount)}</td>
                    <td className="center">{p.paymentDate}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td colSpan={isMixedPeriod ? 5 : 4} className="right">
                    總筆數：{list.length} 筆
                  </td>
                  <td className="num" colSpan={2}>
                    總金額：${formatCurrency(handover.totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* 臨時收費明細 */}
          {adhocList.length > 0 && (
            <>
              <h3 className="section">臨時收費明細</h3>
              <table className="payments">
                <thead>
                  <tr>
                    <th style={{ width: "8%" }}>序號</th>
                    <th style={{ width: "12%" }}>棟別</th>
                    <th style={{ width: "18%" }}>住戶</th>
                    <th style={{ width: "22%" }}>收費專案</th>
                    <th style={{ width: "15%" }}>金額</th>
                    <th style={{ width: "20%" }}>日期</th>
                  </tr>
                </thead>
                <tbody>
                  {adhocList.map((p, i) => (
                    <tr key={p.id}>
                      <td className="center">{i + 1}</td>
                      <td className="center">{p.unitCode ?? "-"}</td>
                      <td>{p.ownerName ?? "-"}</td>
                      <td>{p.projectName ?? "-"}</td>
                      <td className="num">${formatCurrency(p.amount)}</td>
                      <td className="center">{p.paymentDate}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td colSpan={4} className="right">
                      總筆數：{adhocList.length} 筆
                    </td>
                    <td className="num" colSpan={2}>
                      小計：${formatCurrency(adhocList.reduce((s, p) => s + p.amount, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {/* 轉帳明細（非現金，不計入交付總金額） */}
          {transfers.length > 0 && (
            <>
              <h3 className="section">轉帳明細（非現金）</h3>
              <table className="payments">
                <thead>
                  <tr>
                    <th style={{ width: "7%" }}>序號</th>
                    <th style={{ width: "11%" }}>棟別</th>
                    <th style={{ width: "16%" }}>住戶</th>
                    <th style={{ width: "16%" }}>項目</th>
                    <th style={{ width: "18%" }}>收據編號</th>
                    <th style={{ width: "14%" }}>金額</th>
                    <th style={{ width: "10%" }}>狀態</th>
                    <th style={{ width: "18%" }}>日期</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t, i) => (
                    <tr key={t.key}>
                      <td className="center">{i + 1}</td>
                      <td className="center">{t.unitCode ?? "-"}</td>
                      <td>{t.ownerName ?? "-"}</td>
                      <td className="center">{t.item}</td>
                      <td className="center">{t.receiptNumber ?? "－"}</td>
                      <td className="num">${formatCurrency(t.amount)}</td>
                      <td className="center">已轉帳</td>
                      <td className="center">{t.paymentDate}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td colSpan={5} className="right">
                      總筆數：{transfers.length} 筆
                    </td>
                    <td className="num" colSpan={3}>
                      轉帳小計：${formatCurrency(transferTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="note-transfer">
                ※ 轉帳款項已直接匯入社區帳戶，不含在本次交付現金內，僅供核對。
              </p>
            </>
          )}

          {/* 核對 */}
          <h3 className="section">金額核對</h3>
          <table className="verify">
            <tbody>
              <tr>
                <th>繳費總額</th>
                <td className="num">${formatCurrency(handover.totalAmount)}</td>
                <th>幣別合計</th>
                <td className="num">
                  ${formatCurrency(handover.denominationTotal)}
                </td>
              </tr>
              <tr>
                <th>差額</th>
                <td className="num" colSpan={3}>
                  {difference === 0
                    ? "核對正確 ✓"
                    : difference > 0
                      ? `多出 $${formatCurrency(difference)}`
                      : `短少 $${formatCurrency(Math.abs(difference))}`}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 簽收欄 */}
          <div className="sign">
            <div className="sign-box">
              <div className="sign-label">交付人簽名</div>
              <div className="sign-line">&nbsp;</div>
              <div className="sign-date">日期：　　　　</div>
            </div>
            <div className="sign-box">
              <div className="sign-label">接收主管簽名</div>
              <div className="sign-line">&nbsp;</div>
              <div className="sign-date">日期：　　　　</div>
            </div>
          </div>

          <div className="footer">列印時間：{printTime}</div>
        </div>
      </div>

      <style>{`
        @page {
          size: A4 portrait;
          margin: 15mm 12mm;
        }
        html, body {
          background: #f3f4f6;
          margin: 0;
          padding: 0;
          font-family: "Microsoft JhengHei", "PingFang TC", "Noto Sans TC",
            "Heiti TC", sans-serif;
          color: #111;
        }
        .print-root {
          max-width: 210mm;
          margin: 0 auto;
          padding: 16px;
        }
        .toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding: 12px 16px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .btn-print {
          background: #2563eb;
          color: #fff;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
        }
        .btn-print:hover { background: #1d4ed8; }
        .btn-back {
          color: #374151;
          text-decoration: none;
          padding: 8px 16px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
        }
        .tip { color: #6b7280; font-size: 12px; margin-left: auto; }

        .sheet {
          background: #fff;
          padding: 20mm 15mm;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
          min-height: 297mm;
          box-sizing: border-box;
        }
        .title {
          text-align: center;
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 6px 0;
          letter-spacing: 2px;
        }
        .subtitle {
          text-align: center;
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
          letter-spacing: 4px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        th, td {
          border: 1px solid #333;
          padding: 6px 8px;
          vertical-align: middle;
        }
        .meta th {
          background: #f3f4f6;
          width: 15%;
          text-align: center;
        }
        .meta td {
          width: 35%;
        }

        .section {
          font-size: 14px;
          font-weight: 700;
          margin: 14px 0 6px 0;
          padding-left: 8px;
          border-left: 4px solid #2563eb;
        }

        .denom th, .payments th {
          background: #f3f4f6;
          text-align: center;
          font-weight: 600;
        }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .center { text-align: center; }
        .right { text-align: right; }
        .total td {
          background: #fafafa;
          font-weight: 700;
        }
        .empty {
          text-align: center;
          color: #888;
          padding: 16px 0;
          border: 1px dashed #ccc;
          font-size: 12px;
        }
        .note-transfer {
          margin-top: 6px;
          font-size: 11px;
          color: #666;
        }
        .verify th {
          background: #f3f4f6;
          width: 18%;
          text-align: center;
        }
        .verify td { width: 32%; font-weight: 600; }

        .sign {
          display: flex;
          gap: 24px;
          margin-top: 30px;
        }
        .sign-box { flex: 1; }
        .sign-label {
          font-size: 12px;
          color: #555;
          margin-bottom: 8px;
        }
        .sign-line {
          border-bottom: 1.5px solid #333;
          height: 50px;
        }
        .sign-date {
          font-size: 12px;
          color: #555;
          margin-top: 6px;
        }

        .footer {
          margin-top: 24px;
          text-align: right;
          font-size: 10px;
          color: #888;
        }

        @media print {
          html, body { background: #fff; }
          .no-print { display: none !important; }
          .print-root { max-width: none; margin: 0; padding: 0; }
          .sheet {
            box-shadow: none;
            padding: 0;
            min-height: auto;
          }
          .section { break-inside: avoid; }
          table { break-inside: auto; }
          tr { break-inside: avoid; }
        }
      `}</style>
    </>
  )
}
