"use client"

import { useEffect, useState, useCallback } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Camera, Check, X, Loader2 } from "lucide-react"
import { formatCurrency } from "@/lib/date-utils"
import { BUILDINGS, FEE_ITEMS, PAYMENT_METHODS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { recognizeReceiptNumber } from "@/lib/ocr"

interface Household {
  id: number
  unitCode: string
  building: string
  doorNumber: number
  ownerName: string
  managementFee: number
  carParkingFee: number
  motorParkingFee: number
  cardFee: number
  cableTvFee: number
  sensorFee: number
}

interface Period {
  id: number
  periodName: string
  status: string
}

export default function CollectPage() {
  const [households, setHouseholds] = useState<Household[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [paidIds, setPaidIds] = useState<Set<number>>(new Set())
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null)
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  // dialog 內可獨立選期別；預設跟頁面 selectedPeriod 一致，但可當場改
  const [dialogPeriodId, setDialogPeriodId] = useState<number | null>(null)
  // dialog 選的期別中，這戶是否已繳（作為警告提示）
  const [dialogPeriodPaid, setDialogPeriodPaid] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // 表單欄位
  const [fees, setFees] = useState({
    managementFee: 0,
    carParkingFee: 0,
    motorParkingFee: 0,
    cardFee: 0,
    cableTvFee: 0,
    sensorFee: 0,
  })
  // 其他費用
  const [otherFee, setOtherFee] = useState(0)
  const [otherFeeNote, setOtherFeeNote] = useState("")
  // 收據編號（OCR 或手動輸入）
  const [receiptNumber, setReceiptNumber] = useState("")
  const [ocrLoading, setOcrLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [paymentDate, setPaymentDate] = useState("")
  const [collectorName, setCollectorName] = useState("")
  const [note, setNote] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // 載入資料
  useEffect(() => {
    loadInitialData()
  }, [])

  // 當期別變更時，載入已繳清單
  const loadPaidList = useCallback(async (periodId: number) => {
    try {
      const res = await fetch(`/api/payments?periodId=${periodId}`)
      const data = await res.json()
      const ids = new Set<number>(data.map((p: { householdId: number }) => p.householdId))
      setPaidIds(ids)
    } catch {
      console.error("載入繳費記錄失敗")
    }
  }, [])

  useEffect(() => {
    if (selectedPeriod) {
      loadPaidList(selectedPeriod)
    }
  }, [selectedPeriod, loadPaidList])

  const loadInitialData = async () => {
    try {
      const [householdsRes, periodsRes] = await Promise.all([
        fetch("/api/households"),
        fetch("/api/periods"),
      ])
      const householdsData = await householdsRes.json()
      const periodsData = await periodsRes.json()
      setHouseholds(householdsData)
      setPeriods(periodsData)

      // 自動選擇開放中的期別
      const openPeriod = periodsData.find((p: Period) => p.status === "open")
      if (openPeriod) {
        setSelectedPeriod(openPeriod.id)
      }

      // 設定今日日期
      const today = new Date().toISOString().split("T")[0]
      setPaymentDate(today)
    } catch {
      toast.error("載入資料失敗")
    } finally {
      setLoading(false)
    }
  }

  // 點擊住戶，開啟收款表單
  const handleSelectHousehold = (h: Household) => {
    if (paidIds.has(h.id)) {
      toast.info(`${h.unitCode} ${h.ownerName} 已繳費`)
      return
    }
    setSelectedHousehold(h)
    setDialogPeriodId(selectedPeriod)
    setDialogPeriodPaid(false)
    setFees({
      managementFee: h.managementFee,
      carParkingFee: h.carParkingFee,
      motorParkingFee: h.motorParkingFee,
      cardFee: h.cardFee,
      cableTvFee: h.cableTvFee,
      sensorFee: h.sensorFee,
    })
    setOtherFee(0)
    setOtherFeeNote("")
    setReceiptNumber("")
    setOcrLoading(false)
    setPaymentMethod("cash")
    setNote("")
    setPhoto(null)
    setPhotoPreview(null)
    setDialogOpen(true)
  }

  // dialog 期別變動時，檢查該戶在目標期別是否已繳費
  useEffect(() => {
    if (!dialogOpen || !dialogPeriodId || !selectedHousehold) {
      setDialogPeriodPaid(false)
      return
    }
    // 同頁面期別：直接用現成的 paidIds
    if (dialogPeriodId === selectedPeriod) {
      setDialogPeriodPaid(paidIds.has(selectedHousehold.id))
      return
    }
    // 不同期別：呼叫 API 查
    let cancelled = false
    fetch(`/api/payments?periodId=${dialogPeriodId}&householdId=${selectedHousehold.id}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!cancelled) {
          setDialogPeriodPaid(Array.isArray(data) && data.length > 0)
        }
      })
      .catch(() => {
        if (!cancelled) setDialogPeriodPaid(false)
      })
    return () => {
      cancelled = true
    }
  }, [dialogOpen, dialogPeriodId, selectedHousehold, selectedPeriod, paidIds])

  // 計算合計（含其他費用）
  const totalAmount = Object.values(fees).reduce((sum, v) => sum + (v || 0), 0) + (otherFee || 0)

  // 拍照處理 + OCR 辨識收據編號
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPhoto(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    // 自動 OCR 辨識收據編號
    setOcrLoading(true)
    try {
      const result = await recognizeReceiptNumber(file)
      if (result.number) {
        setReceiptNumber(result.number)
        toast.success(`辨識到收據編號：${result.number}`)
      } else {
        toast.info("未辨識到收據編號，請手動輸入")
      }
    } catch {
      toast.error("OCR 辨識失敗")
    } finally {
      setOcrLoading(false)
    }
  }

  // 送出收款
  const handleSubmit = async () => {
    if (!dialogPeriodId || !selectedHousehold) return
    setSubmitting(true)
    try {
      // 建立繳費記錄
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: selectedHousehold.id,
          periodId: dialogPeriodId,
          ...fees,
          otherFee: otherFee || 0,
          otherFeeNote: otherFeeNote.trim() || null,
          receiptNumber: receiptNumber.trim() || null,
          paymentMethod,
          paymentDate,
          collectorName,
          note,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "收款失敗")
        return
      }
      const payment = await res.json()

      // 上傳照片
      if (photo) {
        const formData = new FormData()
        formData.append("file", photo)
        await fetch(`/api/payments/${payment.id}/photos`, {
          method: "POST",
          body: formData,
        })
      }

      // 顯示成功訊息（帶上實際收款期別，讓使用者確認）
      const submittedPeriod = periods.find((p) => p.id === dialogPeriodId)
      const periodLabel = submittedPeriod
        ? submittedPeriod.periodName.replace(/月$/, "期")
        : ""
      toast.success(
        `${selectedHousehold.unitCode} ${selectedHousehold.ownerName} ${periodLabel} 收款成功！$${formatCurrency(totalAmount)}`
      )
      // 只有「當場收的就是頁面那期」才更新 paidIds 顯示
      if (dialogPeriodId === selectedPeriod) {
        setPaidIds((prev) => new Set([...prev, selectedHousehold.id]))
      }
      setDialogOpen(false)
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

  // 按棟別分組
  const groupedHouseholds = BUILDINGS.map((building) => ({
    building,
    units: households.filter((h) => h.building === building),
  }))

  return (
    <AppShell>
      {/* 頁面標題 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">收款作業</h2>
          <p className="text-sm text-gray-500 mt-1">點擊住戶進行收款</p>
        </div>

        {/* 期別選擇 */}
        <Select
          value={selectedPeriod?.toString() ?? ""}
          onValueChange={(v) => setSelectedPeriod(Number(v))}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="選擇期別" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                {p.periodName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 圖例 */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-500" />
          <span className="text-gray-600">已繳</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-500" />
          <span className="text-gray-600">未繳</span>
        </div>
        <div className="ml-auto text-gray-400">
          已繳 {paidIds.size} / 共 {households.length} 戶
        </div>
      </div>

      {/* 住戶網格 - 按棟別分群 */}
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
                  return (
                    <button
                      key={h.id}
                      onClick={() => handleSelectHousehold(h)}
                      className={cn(
                        "relative flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all text-center min-h-[72px]",
                        isPaid
                          ? "bg-green-50 border-green-300 text-green-700"
                          : "bg-red-50 border-red-300 text-red-700 hover:bg-red-100 hover:border-red-400 cursor-pointer"
                      )}
                    >
                      {isPaid && (
                        <Check className="absolute top-1 right-1 h-3.5 w-3.5 text-green-600" />
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

      {/* 收款表單 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              收款 - {selectedHousehold?.unitCode} {selectedHousehold?.ownerName}
              {dialogPeriodId && (
                <span className="text-sm font-normal text-gray-500">
                  （{periods.find((p) => p.id === dialogPeriodId)?.periodName.replace(/月$/, "期") ?? ""}）
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 期別選擇（可當場改，預設跟頁面選的一致） */}
            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span>收款期別</span>
                {dialogPeriodId !== selectedPeriod && (
                  <span className="text-xs text-amber-600">
                    ⚠ 已與頁面期別不同
                  </span>
                )}
              </Label>
              <Select
                value={dialogPeriodId?.toString() ?? ""}
                onValueChange={(v) => setDialogPeriodId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇期別" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.periodName.replace(/月$/, "期")}
                      {p.status !== "open" && "（已關閉）"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {dialogPeriodPaid && (
                <p className="text-xs text-red-600">
                  ⚠ 本戶在此期別已有繳費記錄，再次送出將建立重複記錄
                </p>
              )}
            </div>

            {/* 費用明細 */}
            <div className="space-y-2">
              {/* 主要費用：管理費 + 汽車位（常態顯示） */}
              {FEE_ITEMS.filter((item) => item.primary).map((item) => {
                const value = fees[item.key as keyof typeof fees]
                return (
                  <div key={item.key} className="flex items-center justify-between">
                    <Label className="text-sm">{item.label}</Label>
                    <Input
                      type="number"
                      className="w-28 text-right"
                      value={value || ""}
                      onChange={(e) =>
                        setFees((prev) => ({
                          ...prev,
                          [item.key]: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                )
              })}
              {/* 其他費用項目（折疊區） */}
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer py-1">其他費用項目</summary>
                <div className="space-y-2 mt-2">
                  {FEE_ITEMS.filter((item) => !item.primary).map((item) => {
                    const value = fees[item.key as keyof typeof fees]
                    return (
                      <div key={item.key} className="flex items-center justify-between">
                        <Label className="text-sm text-gray-500">{item.label}</Label>
                        <Input
                          type="number"
                          className="w-28 text-right"
                          value={value || ""}
                          placeholder="0"
                          onChange={(e) =>
                            setFees((prev) => ({
                              ...prev,
                              [item.key]: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </div>
                    )
                  })}
                  {/* 自定義其他費用 */}
                  <div className="pt-2 border-t border-dashed space-y-2">
                    <div className="flex items-center justify-between">
                      <Input
                        className="w-24 text-sm"
                        placeholder="費用名稱"
                        value={otherFeeNote}
                        onChange={(e) => setOtherFeeNote(e.target.value)}
                      />
                      <Input
                        type="number"
                        className="w-28 text-right"
                        value={otherFee || ""}
                        placeholder="0"
                        onChange={(e) => setOtherFee(Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              </details>
              {/* 合計 */}
              <div className="flex items-center justify-between pt-2 border-t font-bold">
                <span>合計</span>
                <span className="text-lg text-blue-700">${formatCurrency(totalAmount)}</span>
              </div>
            </div>

            {/* 付款方式 */}
            <div className="space-y-2">
              <Label>付款方式</Label>
              <Select value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v)}>
                <SelectTrigger>
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
            </div>

            {/* 收款日期 */}
            <div className="space-y-2">
              <Label>收款日期</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            {/* 代收款人 */}
            <div className="space-y-2">
              <Label>代收款人</Label>
              <Input
                placeholder="選填"
                value={collectorName}
                onChange={(e) => setCollectorName(e.target.value)}
              />
            </div>

            {/* 收據編號 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                收據編號
                {ocrLoading && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
              </Label>
              <Input
                placeholder="拍照自動辨識，或手動輸入 NO.XXXXXX"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
              />
              {ocrLoading && (
                <p className="text-xs text-gray-400">辨識收據號碼中...</p>
              )}
            </div>

            {/* 拍照收據 */}
            <div className="space-y-2">
              <Label>收據照片</Label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <Camera className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {photo ? "重新拍照" : "拍照上傳"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </label>
                {photo && (
                  <button
                    onClick={() => {
                      setPhoto(null)
                      setPhotoPreview(null)
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="收據預覽"
                  className="mt-2 rounded-lg border max-h-48 object-contain"
                />
              )}
            </div>

            {/* 備註 */}
            <div className="space-y-2">
              <Label>備註</Label>
              <Textarea
                placeholder="選填"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>

            {/* 送出按鈕 */}
            <Button
              onClick={handleSubmit}
              disabled={submitting || totalAmount === 0}
              className="w-full h-12 text-base"
            >
              {submitting ? "處理中..." : `確認收款 $${formatCurrency(totalAmount)}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
