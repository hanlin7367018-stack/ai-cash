"use client"

import { useEffect, useState, useCallback } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Check, Plus, Lock, ClipboardList } from "lucide-react"
import { formatCurrency, todayString } from "@/lib/date-utils"
import { BUILDINGS, PAYMENT_METHODS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { PaymentMethodDialog } from "@/components/payment-method-dialog"

interface AdhocProject {
  id: number
  name: string
  amount: number
  status: string
  note: string | null
  createdAt: string
  totalHouseholds: number
  paidCount: number
  unpaidCount: number
}

interface Household {
  id: number
  unitCode: string
  building: string
  doorNumber: number
  ownerName: string
}

export default function AdhocPage() {
  const [projects, setProjects] = useState<AdhocProject[]>([])
  const [households, setHouseholds] = useState<Household[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [paidIds, setPaidIds] = useState<Set<number>>(new Set())
  // householdId → 該戶在本專案的 adhocPayment id，供更正付款方式使用
  const [paidPaymentIds, setPaidPaymentIds] = useState<Map<number, number>>(new Map())
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  // 更正付款方式視窗
  const [correctOpen, setCorrectOpen] = useState(false)
  const [correctPaymentId, setCorrectPaymentId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // 建立新專案 dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newAmount, setNewAmount] = useState("")
  const [newNote, setNewNote] = useState("")

  // 收款欄位
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [paymentDate, setPaymentDate] = useState(todayString())
  const [collectorName, setCollectorName] = useState("")

  // 載入資料
  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/adhoc-projects")
    if (res.ok) {
      const data = await res.json()
      setProjects(data)
    }
  }, [])

  const loadHouseholds = useCallback(async () => {
    const res = await fetch("/api/households")
    if (res.ok) {
      const data = await res.json()
      setHouseholds(data)
    }
  }, [])

  const loadProjectDetail = useCallback(async (projectId: number) => {
    const [res, paymentsRes] = await Promise.all([
      fetch(`/api/adhoc-projects/${projectId}`),
      fetch(`/api/adhoc-projects/${projectId}/payments`),
    ])
    if (res.ok) {
      const data = await res.json()
      setPaidIds(new Set(data.paidHouseholdIds || []))
      // 更新專案列表中的統計
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, paidCount: data.paidCount, unpaidCount: data.unpaidCount }
            : p
        )
      )
    }
    // 建立 householdId → adhocPayment id 對應，供更正付款方式取用
    if (paymentsRes.ok) {
      const records: { id: number; householdId: number }[] = await paymentsRes.json()
      const map = new Map<number, number>()
      for (const r of records) {
        if (!map.has(r.householdId)) map.set(r.householdId, r.id)
      }
      setPaidPaymentIds(map)
    }
  }, [])

  useEffect(() => {
    Promise.all([loadProjects(), loadHouseholds()]).finally(() => setLoading(false))
  }, [loadProjects, loadHouseholds])

  // 選專案時載入已繳清單
  useEffect(() => {
    if (selectedProjectId) {
      setSelectedIds(new Set())
      loadProjectDetail(selectedProjectId)
    }
  }, [selectedProjectId, loadProjectDetail])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  // 點擊住戶 toggle 勾選
  const handleToggle = (householdId: number) => {
    // 已繳的住戶改為開啟更正視窗，供付款方式按錯時修正
    if (paidIds.has(householdId)) {
      const paymentId = paidPaymentIds.get(householdId)
      if (paymentId) {
        setCorrectPaymentId(paymentId)
        setCorrectOpen(true)
      }
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(householdId)) {
        next.delete(householdId)
      } else {
        next.add(householdId)
      }
      return next
    })
  }

  // 全選未繳
  const handleSelectAll = () => {
    const unpaidHouseholdIds = households
      .filter((h) => !paidIds.has(h.id))
      .map((h) => h.id)
    setSelectedIds(new Set(unpaidHouseholdIds))
  }

  // 取消全選
  const handleDeselectAll = () => {
    setSelectedIds(new Set())
  }

  // 建立新專案
  const handleCreateProject = async () => {
    const amount = Number(newAmount)
    if (!newName.trim() || !amount || amount <= 0) {
      toast.error("請填寫專案名稱和正確金額")
      return
    }
    const res = await fetch("/api/adhoc-projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        amount,
        note: newNote.trim() || null,
      }),
    })
    if (res.ok) {
      const project = await res.json()
      toast.success(`已建立專案：${project.name}`)
      setCreateDialogOpen(false)
      setNewName("")
      setNewAmount("")
      setNewNote("")
      await loadProjects()
      setSelectedProjectId(project.id)
    } else {
      const err = await res.json()
      toast.error(err.error || "建立失敗")
    }
  }

  // 結案
  const handleCloseProject = async (projectId: number) => {
    if (!window.confirm("確定要結案此專案？結案後無法再收款。")) return
    const res = await fetch(`/api/adhoc-projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    })
    if (res.ok) {
      toast.success("已結案")
      await loadProjects()
    }
  }

  // 確認收款
  const handleCollect = async () => {
    if (!selectedProjectId || selectedIds.size === 0) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/adhoc-projects/${selectedProjectId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdIds: Array.from(selectedIds),
          paymentMethod,
          paymentDate,
          collectorName: collectorName.trim() || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`收款成功！${data.count} 戶，合計 $${formatCurrency(data.totalAmount)}`)
        setSelectedIds(new Set())
        await loadProjectDetail(selectedProjectId)
        await loadProjects()
      } else {
        const err = await res.json()
        toast.error(err.error || "收款失敗")
      }
    } catch {
      toast.error("系統錯誤")
    } finally {
      setSubmitting(false)
    }
  }

  // 按棟別分組
  const groupedHouseholds = BUILDINGS.map((building) => ({
    building,
    units: households.filter((h) => h.building === building),
  }))

  const selectedTotal = selectedIds.size * (selectedProject?.amount ?? 0)

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
      {/* 頁面標題 + 專案選擇 */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">臨時收費</h2>
          <p className="text-sm text-gray-500 mt-1">公共維護費、機車停車費等臨時性收費</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedProjectId?.toString() ?? ""}
            onValueChange={(v) => setSelectedProjectId(Number(v))}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="選擇收費專案" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name}
                  {p.status === "closed" ? " (已結案)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            新專案
          </Button>
        </div>
      </div>

      {/* 尚未選擇專案 */}
      {!selectedProject && (
        <div className="space-y-4">
          {projects.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>尚無臨時收費專案</p>
                <p className="text-sm mt-1">點擊「新專案」建立第一個收費專案</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => (
                <Card
                  key={p.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    p.status === "closed" && "opacity-60"
                  )}
                  onClick={() => setSelectedProjectId(p.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <Badge variant={p.status === "open" ? "default" : "secondary"}>
                        {p.status === "open" ? "收費中" : "已結案"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold text-blue-600">
                      每戶 ${formatCurrency(p.amount)}
                    </p>
                    <div className="flex items-center justify-between mt-2 text-sm text-gray-500">
                      <span>已繳 {p.paidCount} / {p.totalHouseholds} 戶</span>
                      <span>未繳 {p.unpaidCount} 戶</span>
                    </div>
                    {/* 進度條 */}
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${p.totalHouseholds > 0 ? (p.paidCount / p.totalHouseholds) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    {p.note && (
                      <p className="text-xs text-gray-400 mt-2">{p.note}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 已選專案 → 顯示收款網格 */}
      {selectedProject && (
        <>
          {/* 專案資訊 */}
          <Card className="mb-4">
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold">{selectedProject.name}</h3>
                  <Badge variant={selectedProject.status === "open" ? "default" : "secondary"}>
                    {selectedProject.status === "open" ? "收費中" : "已結案"}
                  </Badge>
                  <span className="text-blue-600 font-medium">
                    每戶 ${formatCurrency(selectedProject.amount)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedProject.status === "open" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCloseProject(selectedProject.id)}
                    >
                      <Lock className="h-4 w-4 mr-1" />
                      結案
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 圖例 + 快捷操作 */}
          <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-green-500" />
              <span className="text-gray-600">已繳</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-red-500" />
              <span className="text-gray-600">未繳</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-yellow-400" />
              <span className="text-gray-600">已勾���</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-gray-400">
                已繳 {paidIds.size} / 共 {households.length} 戶
              </span>
              {selectedProject.status === "open" && (
                <>
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    全選未繳
                  </Button>
                  {selectedIds.size > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleDeselectAll}>
                      取消全選
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 住戶網格 */}
          <div className="space-y-4">
            {groupedHouseholds.map(({ building, units }) => (
              <Card key={building}>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">{building} 棟</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {units.map((h) => {
                      const isPaid = paidIds.has(h.id)
                      const isSelected = selectedIds.has(h.id)
                      // 已繳仍可點（開啟更正付款方式視窗），
                      // 只有「未繳且專案已結案」才禁用
                      return (
                        <button
                          key={h.id}
                          onClick={() => handleToggle(h.id)}
                          disabled={!isPaid && selectedProject.status === "closed"}
                          className={cn(
                            "relative flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all text-center min-h-[72px]",
                            isPaid
                              ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100 hover:border-green-400 cursor-pointer"
                              : isSelected
                                ? "bg-yellow-50 border-yellow-400 text-yellow-800 ring-2 ring-yellow-300"
                                : "bg-red-50 border-red-300 text-red-700 hover:bg-red-100 hover:border-red-400 cursor-pointer",
                            !isPaid && selectedProject.status === "closed" && "cursor-default"
                          )}
                        >
                          {isPaid && (
                            <Check className="absolute top-1 right-1 h-3.5 w-3.5 text-green-600" />
                          )}
                          {isSelected && (
                            <Check className="absolute top-1 right-1 h-3.5 w-3.5 text-yellow-600" />
                          )}
                          <span className="text-xs font-bold">{h.unitCode}</span>
                          <span className="text-[10px] mt-0.5 truncate w-full">{h.ownerName}</span>
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 底部操作列 */}
          {selectedProject.status === "open" && selectedIds.size > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50">
              <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="text-sm">
                    <span className="font-semibold text-lg">
                      已勾選 {selectedIds.size} 戶
                    </span>
                    <span className="text-gray-500 ml-2">
                      合計 ${formatCurrency(selectedTotal)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Select value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v)}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-36"
                    />
                    <Input
                      placeholder="代收人"
                      value={collectorName}
                      onChange={(e) => setCollectorName(e.target.value)}
                      className="w-24"
                    />
                    <Button
                      onClick={handleCollect}
                      disabled={submitting}
                      className="min-w-[140px]"
                    >
                      {submitting ? "處理中..." : `確認收款 $${formatCurrency(selectedTotal)}`}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 底部間距（避免被固定操作列擋住） */}
          {selectedProject.status === "open" && selectedIds.size > 0 && (
            <div className="h-24" />
          )}
        </>
      )}

      {/* 建立新專案 Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>建立臨時收費專案</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>專案名稱</Label>
              <Input
                placeholder="如：115年第一季機車停車費"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <Label>每戶金額</Label>
              <Input
                type="number"
                placeholder="0"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>備註（選填）</Label>
              <Input
                placeholder="備註說明"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
            </div>
            <Button onClick={handleCreateProject} className="w-full">
              建立專案
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 更正付款方式（點已繳住戶時開啟） */}
      <PaymentMethodDialog
        open={correctOpen}
        onOpenChange={setCorrectOpen}
        kind="adhoc"
        paymentId={correctPaymentId}
        onUpdated={() => {
          if (selectedProjectId) loadProjectDetail(selectedProjectId)
        }}
      />
    </AppShell>
  )
}
