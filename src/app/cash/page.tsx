"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Wallet, ArrowRightLeft, CheckCircle2, FileDown, FileSpreadsheet } from "lucide-react"
import { DENOMINATIONS, calculateDenominationTotal } from "@/lib/constants"
import { formatCurrency, todayString } from "@/lib/date-utils"
import { cn } from "@/lib/utils"

interface HandoverRecord {
  id: number
  handoverDate: string
  totalCount: number
  totalAmount: number
  denominationTotal: number
  receiverName: string
  handoverBy: string
  createdAt: string
}

export default function CashPage() {
  const [cashBalance, setCashBalance] = useState(0)
  const [regularBalance, setRegularBalance] = useState(0)
  const [adhocBalance, setAdhocBalance] = useState(0)
  const [handovers, setHandovers] = useState<HandoverRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // 盤點表單 - 各幣別數量
  const [counts, setCounts] = useState<Record<number, number>>({})

  // 交付表單
  const [receiverName, setReceiverName] = useState("")
  const [handoverBy, setHandoverBy] = useState("")
  const [handoverNote, setHandoverNote] = useState("")

  // 目前開放的期別
  const [currentPeriodId, setCurrentPeriodId] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [balanceRes, handoversRes, periodsRes] = await Promise.all([
        fetch("/api/cash/balance"),
        fetch("/api/cash/handovers"),
        fetch("/api/periods"),
      ])
      const balanceData = await balanceRes.json()
      setCashBalance(balanceData.balance)
      setRegularBalance(balanceData.regularBalance ?? balanceData.balance)
      setAdhocBalance(balanceData.adhocBalance ?? 0)

      const handoversData = await handoversRes.json()
      setHandovers(handoversData)

      const periodsData = await periodsRes.json()
      const openPeriod = periodsData.find((p: { status: string }) => p.status === "open")
      if (openPeriod) setCurrentPeriodId(openPeriod.id)
    } catch {
      toast.error("載入資料失敗")
    } finally {
      setLoading(false)
    }
  }

  // 計算盤點合計
  const denominationTotal = calculateDenominationTotal(counts)

  // 差額
  const difference = denominationTotal - cashBalance

  // 更新幣別數量
  const updateCount = (value: number, count: number) => {
    setCounts((prev) => ({ ...prev, [value]: count }))
  }

  // 執行交付
  const handleHandover = async () => {
    if (!currentPeriodId) {
      toast.error("請先建立收費期別")
      return
    }
    if (!receiverName.trim()) {
      toast.error("請輸入接收主管姓名")
      return
    }
    if (!handoverBy.trim()) {
      toast.error("請輸入交付人姓名")
      return
    }
    if (cashBalance === 0) {
      toast.error("目前無待交付現金")
      return
    }
    if (denominationTotal === 0) {
      toast.error("請先完成幣別盤點")
      return
    }
    if (denominationTotal !== cashBalance) {
      const diff = Math.abs(denominationTotal - cashBalance)
      const confirmed = window.confirm(
        `盤點金額 $${formatCurrency(denominationTotal)} 與應有金額 $${formatCurrency(cashBalance)} 不符，差額 $${formatCurrency(diff)}。\n\n確定仍要交付？`
      )
      if (!confirmed) return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/cash/handovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodId: currentPeriodId,
          bill2000: counts[2000] || 0,
          bill1000: counts[1000] || 0,
          bill500: counts[500] || 0,
          bill200: counts[200] || 0,
          coin100: counts[100] || 0,
          coin50: counts[50] || 0,
          coin20: counts[20] || 0,
          coin10: counts[10] || 0,
          coin5: counts[5] || 0,
          coin1: counts[1] || 0,
          receiverName: receiverName.trim(),
          handoverBy: handoverBy.trim(),
          note: handoverNote.trim(),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "交付失敗")
        return
      }

      toast.success("現金交付完成！餘額已歸零。")

      // 重設表單
      setCounts({})
      setReceiverName("")
      setHandoverBy("")
      setHandoverNote("")

      // 重新載入
      loadData()
    } catch {
      toast.error("系統錯誤")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">載入中...</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">現金管理</h2>
        <p className="text-sm text-gray-500 mt-1">幣別盤點與交付主管</p>
      </div>

      {/* 手持現金卡片 */}
      <Card className="mb-6 border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="h-8 w-8 text-amber-600" />
              <div>
                <p className="text-sm text-amber-700">目前���持現金</p>
                <p className="text-3xl font-bold text-amber-800">
                  ${formatCurrency(cashBalance)}
                </p>
                {adhocBalance > 0 && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    管理費 ${formatCurrency(regularBalance)} · 臨時收費 ${formatCurrency(adhocBalance)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="inventory">
        <TabsList className="mb-4">
          <TabsTrigger value="inventory">幣別盤點</TabsTrigger>
          <TabsTrigger value="history">交付記錄</TabsTrigger>
        </TabsList>

        {/* 幣別盤點 */}
        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">現金幣別盤點</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 盤點表格 */}
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-sm font-medium text-gray-500 px-1">
                  <span>面額</span>
                  <span className="text-center">數量</span>
                  <span className="text-center">單位</span>
                  <span className="text-right">小計</span>
                </div>
                {DENOMINATIONS.map((d) => {
                  const count = counts[d.value] || 0
                  const subtotal = count * d.value
                  return (
                    <div
                      key={d.value}
                      className="grid grid-cols-4 gap-2 items-center py-1.5 border-b last:border-0"
                    >
                      <span className="text-sm font-medium">{d.label}</span>
                      <Input
                        type="number"
                        min={0}
                        className="text-center h-9"
                        value={count || ""}
                        placeholder="0"
                        onChange={(e) => updateCount(d.value, Number(e.target.value) || 0)}
                      />
                      <span className="text-center text-sm text-gray-400">{d.unit}</span>
                      <span className="text-right text-sm font-mono">
                        {subtotal > 0 ? `$${formatCurrency(subtotal)}` : "-"}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* 盤點合計與核對 */}
              <div className="mt-4 pt-4 border-t space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">盤點合計</span>
                  <span className="font-bold text-lg">${formatCurrency(denominationTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">應有金額</span>
                  <span className="font-medium">${formatCurrency(cashBalance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">差額</span>
                  <span
                    className={cn(
                      "font-bold",
                      difference === 0 && denominationTotal > 0
                        ? "text-green-600"
                        : difference > 0
                          ? "text-blue-600"
                          : difference < 0
                            ? "text-red-600"
                            : "text-gray-400"
                    )}
                  >
                    {difference === 0 && denominationTotal > 0
                      ? "核對正確 ✓"
                      : difference > 0
                        ? `多出 $${formatCurrency(difference)}`
                        : difference < 0
                          ? `短少 $${formatCurrency(Math.abs(difference))}`
                          : "-"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 交付表單 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                交付主管
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>接收主管</Label>
                <Input
                  placeholder="主管姓名"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>交付人</Label>
                <Input
                  placeholder="您的姓名"
                  value={handoverBy}
                  onChange={(e) => setHandoverBy(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>備註</Label>
                <Input
                  placeholder="選填"
                  value={handoverNote}
                  onChange={(e) => setHandoverNote(e.target.value)}
                />
              </div>

              {denominationTotal > 0 && denominationTotal !== cashBalance && (
                <p className="text-sm text-amber-600 text-center">
                  ⚠ 盤點金額與應有金額不符，差額 ${formatCurrency(Math.abs(denominationTotal - cashBalance))}
                </p>
              )}

              <Button
                onClick={handleHandover}
                disabled={submitting || cashBalance === 0}
                className="w-full h-12 text-base"
              >
                {submitting
                  ? "處理中..."
                  : `確認交付 $${formatCurrency(cashBalance)}`}
              </Button>
              <p className="text-xs text-gray-400 text-center">
                交付後手持現金將歸零，繳費記錄保留不變
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 交付記錄 */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">交付記錄</CardTitle>
            </CardHeader>
            <CardContent>
              {handovers.length === 0 ? (
                <p className="text-gray-400 text-center py-8">尚無交付記錄</p>
              ) : (
                <div className="space-y-3">
                  {handovers.map((h) => (
                    <div
                      key={h.id}
                      className="py-3 border-b last:border-0 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              交付給 {h.receiverName}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {h.handoverDate} · {h.totalCount} 筆 · 交付人：{h.handoverBy}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold">${formatCurrency(h.totalAmount)}</p>
                          {h.denominationTotal !== h.totalAmount && (
                            <Badge variant="destructive" className="text-xs">
                              幣別差額 ${formatCurrency(h.denominationTotal - h.totalAmount)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            window.open(
                              `/cash/handovers/${h.id}/print`,
                              "_blank"
                            )
                          }
                        >
                          <FileDown className="h-4 w-4 mr-1" />
                          簽收單
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            window.open(
                              `/api/reports/export-excel?type=handover&id=${h.id}`,
                              "_blank"
                            )
                          }
                        >
                          <FileSpreadsheet className="h-4 w-4 mr-1" />
                          Excel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}
