"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Plus, CalendarDays, ChevronDown, ChevronUp } from "lucide-react"
import { toROCYear, formatCurrency } from "@/lib/date-utils"

interface PeriodStats {
  paidCount: number
  unpaidCount: number
  totalHouseholds: number
  totalCollected: number
}

interface PaidItem {
  unitCode: string
  ownerName: string
  totalAmount: number
  paymentDate: string
}

interface UnpaidItem {
  unitCode: string
  ownerName: string
  totalDue: number
}

interface Period {
  id: number
  rocYear: number
  startMonth: number
  endMonth: number
  periodName: string
  status: string
  createdAt: string
}

// 雙月選項
const BIMONTH_OPTIONS = [
  { start: 1, end: 2, label: "1-2月" },
  { start: 3, end: 4, label: "3-4月" },
  { start: 5, end: 6, label: "5-6月" },
  { start: 7, end: 8, label: "7-8月" },
  { start: 9, end: 10, label: "9-10月" },
  { start: 11, end: 12, label: "11-12月" },
]

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // drill-down 展開
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [drillStats, setDrillStats] = useState<PeriodStats | null>(null)
  const [drillPaid, setDrillPaid] = useState<PaidItem[]>([])
  const [drillUnpaid, setDrillUnpaid] = useState<UnpaidItem[]>([])
  const [drillLoading, setDrillLoading] = useState(false)
  // 展開後的子 tab：unpaid | paid
  const [drillTab, setDrillTab] = useState<"unpaid" | "paid">("unpaid")

  const currentROCYear = toROCYear(new Date())
  const [newYear, setNewYear] = useState(currentROCYear)
  const [newBimonth, setNewBimonth] = useState("1-2")

  useEffect(() => {
    loadPeriods()
  }, [])

  const loadPeriods = async () => {
    try {
      const res = await fetch("/api/periods")
      setPeriods(await res.json())
    } catch {
      toast.error("載入期別失敗")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    const bimonth = BIMONTH_OPTIONS.find(
      (b) => `${b.start}-${b.end}` === newBimonth
    )
    if (!bimonth) return

    setSubmitting(true)
    try {
      const res = await fetch("/api/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rocYear: newYear,
          startMonth: bimonth.start,
          endMonth: bimonth.end,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "建立失敗")
        return
      }
      toast.success("期別建立成功")
      setDialogOpen(false)
      loadPeriods()
    } catch {
      toast.error("系統錯誤")
    } finally {
      setSubmitting(false)
    }
  }

  // 展開/收合期別明細
  const handleToggleExpand = async (periodId: number) => {
    if (expandedId === periodId) {
      setExpandedId(null)
      return
    }
    setExpandedId(periodId)
    setDrillLoading(true)
    setDrillTab("unpaid")
    try {
      const [statsRes, paidRes, unpaidRes] = await Promise.all([
        fetch(`/api/periods/${periodId}`),
        fetch(`/api/payments?periodId=${periodId}`),
        fetch(`/api/payments/unpaid?periodId=${periodId}`),
      ])
      const statsData = await statsRes.json()
      setDrillStats(statsData)
      setDrillPaid(await paidRes.json())
      setDrillUnpaid(await unpaidRes.json())
    } catch {
      toast.error("載入明細失敗")
    } finally {
      setDrillLoading(false)
    }
  }

  const handleToggleStatus = async (period: Period) => {
    const newStatus = period.status === "open" ? "closed" : "open"
    try {
      const res = await fetch(`/api/periods/${period.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        toast.success(newStatus === "closed" ? "已結案" : "已重新開放")
        loadPeriods()
      }
    } catch {
      toast.error("更新失敗")
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">期別管理</h2>
          <p className="text-sm text-gray-500 mt-1">每兩個月一期</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> 新增期別
        </Button>
      </div>

      <div className="space-y-3">
        {periods.map((p) => (
          <Card key={p.id}>
            <CardContent className="py-4 space-y-0">
              <div className="flex items-center justify-between">
                <button
                  className="flex items-center gap-3 text-left flex-1"
                  onClick={() => handleToggleExpand(p.id)}
                >
                  <CalendarDays className="h-5 w-5 text-gray-400 shrink-0" />
                  <div>
                    <p className="font-medium">{p.periodName}</p>
                    <p className="text-xs text-gray-400">
                      建立於 {p.createdAt?.split("T")[0] || p.createdAt}
                    </p>
                  </div>
                  {expandedId === p.id ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                <div className="flex items-center gap-3">
                  <Badge variant={p.status === "open" ? "default" : "secondary"}>
                    {p.status === "open" ? "收費中" : "已結案"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleToggleStatus(p) }}
                  >
                    {p.status === "open" ? "結案" : "重新開放"}
                  </Button>
                </div>
              </div>

              {/* 展開區：統計 + 已繳/未繳清單 */}
              {expandedId === p.id && (
                <div className="pt-4 mt-4 border-t">
                  {drillLoading ? (
                    <p className="text-center text-gray-400 py-4">載入中...</p>
                  ) : (
                    <>
                      {/* 統計摘要 */}
                      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                        <div className="bg-green-50 rounded-lg p-2">
                          <p className="text-green-600 font-bold text-lg">{drillStats?.paidCount ?? 0}</p>
                          <p className="text-xs text-gray-500">已繳</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-2">
                          <p className="text-red-600 font-bold text-lg">{drillStats?.unpaidCount ?? 0}</p>
                          <p className="text-xs text-gray-500">未繳</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2">
                          <p className="text-blue-600 font-bold text-lg">${formatCurrency(drillStats?.totalCollected ?? 0)}</p>
                          <p className="text-xs text-gray-500">已收金額</p>
                        </div>
                      </div>

                      {/* 子 Tab 切換 */}
                      <div className="flex gap-2 mb-3">
                        <Button
                          variant={drillTab === "unpaid" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setDrillTab("unpaid")}
                        >
                          未繳（{drillUnpaid.length}）
                        </Button>
                        <Button
                          variant={drillTab === "paid" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setDrillTab("paid")}
                        >
                          已繳（{drillPaid.length}）
                        </Button>
                      </div>

                      {/* 未繳清單 */}
                      {drillTab === "unpaid" && (
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                          {drillUnpaid.length === 0 ? (
                            <p className="text-center text-green-600 py-4">全部已繳！</p>
                          ) : (
                            drillUnpaid.map((u) => (
                              <div key={u.unitCode} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                                <span>
                                  <span className="font-bold">{u.unitCode}</span>
                                  <span className="text-gray-500 ml-2">{u.ownerName}</span>
                                </span>
                                <span className="text-red-600 font-medium">${formatCurrency(u.totalDue)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* 已繳清單 */}
                      {drillTab === "paid" && (
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                          {drillPaid.length === 0 ? (
                            <p className="text-center text-gray-400 py-4">尚無收款</p>
                          ) : (
                            drillPaid.map((item) => (
                              <div key={`${item.unitCode}-${item.paymentDate}`} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                                <span>
                                  <span className="font-bold">{item.unitCode}</span>
                                  <span className="text-gray-500 ml-2">{item.ownerName}</span>
                                  <span className="text-gray-400 ml-2 text-xs">{item.paymentDate}</span>
                                </span>
                                <span className="text-green-600 font-medium">${formatCurrency(item.totalAmount)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {periods.length === 0 && !loading && (
          <p className="text-gray-400 text-center py-12">尚無期別，請點擊右上角新增</p>
        )}
      </div>

      {/* 新增期別 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>新增收費期別</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>民國年</Label>
              <Input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>月份</Label>
              <Select value={newBimonth} onValueChange={(v) => v && setNewBimonth(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BIMONTH_OPTIONS.map((b) => (
                    <SelectItem key={`${b.start}-${b.end}`} value={`${b.start}-${b.end}`}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} disabled={submitting} className="w-full">
              {submitting ? "建立中..." : "建立"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
