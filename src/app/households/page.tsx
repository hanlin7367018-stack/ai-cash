"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Plus, Pencil, Search } from "lucide-react"
import { formatCurrency } from "@/lib/date-utils"
import { BUILDINGS, FEE_ITEMS } from "@/lib/constants"

interface Household {
  id: number
  unitCode: string
  building: string
  doorNumber: number
  ownerName: string
  phone: string | null
  managementFee: number
  carParkingFee: number
  motorParkingFee: number
  cardFee: number
  cableTvFee: number
  sensorFee: number
  note: string | null
}

export default function HouseholdsPage() {
  const [households, setHouseholds] = useState<Household[]>([])
  const [loading, setLoading] = useState(true)
  const [filterBuilding, setFilterBuilding] = useState("all")
  const [searchText, setSearchText] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 表單欄位
  const [form, setForm] = useState({
    unitCode: "",
    building: "A",
    doorNumber: 1,
    ownerName: "",
    phone: "",
    managementFee: 0,
    carParkingFee: 0,
    motorParkingFee: 0,
    cardFee: 0,
    cableTvFee: 0,
    sensorFee: 0,
    note: "",
  })

  useEffect(() => {
    loadHouseholds()
  }, [])

  const loadHouseholds = async () => {
    try {
      const res = await fetch("/api/households")
      const data = await res.json()
      setHouseholds(data)
    } catch {
      toast.error("載入住戶資料失敗")
    } finally {
      setLoading(false)
    }
  }

  // 篩選
  const filtered = households.filter((h) => {
    if (filterBuilding !== "all" && h.building !== filterBuilding) return false
    if (searchText) {
      const s = searchText.toLowerCase()
      return (
        h.unitCode.toLowerCase().includes(s) ||
        h.ownerName.toLowerCase().includes(s)
      )
    }
    return true
  })

  // 計算合計
  const calcTotal = (h: Household) =>
    h.managementFee + h.carParkingFee + h.motorParkingFee + h.cardFee + h.cableTvFee + h.sensorFee

  // 開啟編輯
  const openEdit = (h: Household) => {
    setEditingId(h.id)
    setForm({
      unitCode: h.unitCode,
      building: h.building,
      doorNumber: h.doorNumber,
      ownerName: h.ownerName,
      phone: h.phone || "",
      managementFee: h.managementFee,
      carParkingFee: h.carParkingFee,
      motorParkingFee: h.motorParkingFee,
      cardFee: h.cardFee,
      cableTvFee: h.cableTvFee,
      sensorFee: h.sensorFee,
      note: h.note || "",
    })
    setDialogOpen(true)
  }

  // 開啟新增
  const openCreate = () => {
    setEditingId(null)
    setForm({
      unitCode: "",
      building: "A",
      doorNumber: 1,
      ownerName: "",
      phone: "",
      managementFee: 0,
      carParkingFee: 0,
      motorParkingFee: 0,
      cardFee: 0,
      cableTvFee: 0,
      sensorFee: 0,
      note: "",
    })
    setDialogOpen(true)
  }

  // 儲存
  const handleSave = async () => {
    if (!form.ownerName.trim()) {
      toast.error("請輸入住戶姓名")
      return
    }
    setSubmitting(true)
    try {
      const url = editingId ? `/api/households/${editingId}` : "/api/households"
      const method = editingId ? "PUT" : "POST"
      const body = {
        ...form,
        unitCode: form.unitCode || `${form.building}-${form.doorNumber}`,
      }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "儲存失敗")
        return
      }
      toast.success(editingId ? "住戶更新成功" : "住戶新增成功")
      setDialogOpen(false)
      loadHouseholds()
    } catch {
      toast.error("系統錯誤")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">住戶管理</h2>
          <p className="text-sm text-gray-500 mt-1">共 {households.length} 戶</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> 新增住戶
        </Button>
      </div>

      {/* 篩選列 */}
      <div className="flex gap-3 mb-4">
        <Select value={filterBuilding} onValueChange={(v) => v && setFilterBuilding(v)}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="全部棟別" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部棟別</SelectItem>
            {BUILDINGS.map((b) => (
              <SelectItem key={b} value={b}>{b} 棟</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜尋棟號或姓名..."
            className="pl-9"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
      </div>

      {/* 住戶列表 */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">棟號</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead className="text-right hidden sm:table-cell">管理費</TableHead>
                <TableHead className="text-right hidden sm:table-cell">停車費</TableHead>
                <TableHead className="text-right">合計</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-bold">{h.unitCode}</TableCell>
                  <TableCell>{h.ownerName}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    ${formatCurrency(h.managementFee)}
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    ${formatCurrency(h.carParkingFee)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${formatCurrency(calcTotal(h))}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => openEdit(h)}
                      className="p-1.5 rounded hover:bg-gray-100"
                    >
                      <Pencil className="h-4 w-4 text-gray-400" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 新增/編輯 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "編輯住戶" : "新增住戶"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>棟別</Label>
                <Select
                  value={form.building}
                  onValueChange={(v) => v && setForm((f) => ({ ...f, building: v, unitCode: `${v}-${f.doorNumber}` }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUILDINGS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>門號</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.doorNumber}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    setForm((f) => ({ ...f, doorNumber: n, unitCode: `${f.building}-${n}` }))
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>住戶姓名 *</Label>
              <Input
                value={form.ownerName}
                onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>聯絡電話</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            {FEE_ITEMS.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <Label>{item.label}</Label>
                <Input
                  type="number"
                  className="w-32 text-right"
                  value={form[item.key as keyof typeof form] || ""}
                  onChange={(e) => setForm((f) => ({ ...f, [item.key]: Number(e.target.value) || 0 }))}
                />
              </div>
            ))}
            <Button onClick={handleSave} disabled={submitting} className="w-full">
              {submitting ? "儲存中..." : "儲存"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
