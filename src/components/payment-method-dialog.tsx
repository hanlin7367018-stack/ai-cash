"use client"

import { useEffect, useState, useCallback } from "react"
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
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Lock } from "lucide-react"
import { formatCurrency } from "@/lib/date-utils"
import { PAYMENT_METHODS } from "@/lib/constants"

// 更正對象：管理費繳費記錄或臨時收費繳費記錄
export type PaymentKind = "payment" | "adhoc"

interface CorrectionInfo {
  kind: PaymentKind
  id: number
  unitCode: string | null
  ownerName: string | null
  label: string
  receiptNumber: string | null
  totalAmount: number
  paymentMethod: string
  paymentDate: string
  locked: boolean
  handoverId: number | null
  handoverDate: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: PaymentKind
  paymentId: number | null
  // 更正成功後通知呼叫端重新載入清單與餘額
  onUpdated?: () => void
}

// 三個入口（收款作業頁、臨時收費頁、報表中心）共用的付款方式更正視窗
export function PaymentMethodDialog({
  open,
  onOpenChange,
  kind,
  paymentId,
  onUpdated,
}: Props) {
  const [info, setInfo] = useState<CorrectionInfo | null>(null)
  const [method, setMethod] = useState("cash")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const apiBase = kind === "payment" ? "/api/payments" : "/api/adhoc-payments"

  const loadInfo = useCallback(async () => {
    if (!paymentId) return
    setLoading(true)
    setInfo(null)
    try {
      const res = await fetch(`${apiBase}/${paymentId}/method`)
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "載入記錄失敗")
        onOpenChange(false)
        return
      }
      const data: CorrectionInfo = await res.json()
      setInfo(data)
      setMethod(data.paymentMethod)
    } catch {
      toast.error("系統錯誤")
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }, [apiBase, paymentId, onOpenChange])

  useEffect(() => {
    if (open && paymentId) loadInfo()
  }, [open, paymentId, loadInfo])

  const handleSave = async () => {
    if (!info || !paymentId) return
    setSubmitting(true)
    try {
      const res = await fetch(`${apiBase}/${paymentId}/method`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: method }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "更正失敗")
        return
      }
      const label = method === "cash" ? "現金" : "轉帳"
      toast.success(
        `${info.unitCode ?? ""} 已更正為${label}${
          method === "cash" ? "，手持現金已增加" : "，手持現金已扣除"
        } $${formatCurrency(info.totalAmount)}`
      )
      onOpenChange(false)
      onUpdated?.()
    } catch {
      toast.error("系統錯誤")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>更正付款方式</DialogTitle>
        </DialogHeader>

        {loading || !info ? (
          <p className="text-center text-gray-400 py-8">載入中...</p>
        ) : (
          <div className="space-y-4">
            {/* 記錄摘要 */}
            <div className="text-sm space-y-0.5">
              <p className="font-medium">
                {info.unitCode} {info.ownerName}
                <span className="text-gray-500 ml-2">{info.label}</span>
              </p>
              <p className="text-gray-400 text-xs">
                {info.receiptNumber ? `${info.receiptNumber} · ` : ""}
                ${formatCurrency(info.totalAmount)} · {info.paymentDate}
              </p>
            </div>

            {info.locked ? (
              <>
                {/* 已歸戶到簽收單：鎖定並說明原因 */}
                <div className="flex gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                  <Lock className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">
                    此筆已於 {info.handoverDate ?? "交付日"} 交付
                    （簽收單 #{info.handoverId}），不可更改付款方式。
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400">付款方式</Label>
                  <div className="h-9 px-3 flex items-center rounded-md border bg-gray-100 text-sm text-gray-400">
                    {info.paymentMethod === "cash" ? "現金" : "轉帳"}
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => onOpenChange(false)}
                >
                  關閉
                </Button>
              </>
            ) : (
              <>
                {/* 可更正 */}
                <div className="space-y-2">
                  <Label>付款方式</Label>
                  <Select value={method} onValueChange={(v) => v && setMethod(v)}>
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
                  <p className="text-xs text-gray-400">
                    只會變更付款方式，金額、收據編號、照片等其餘欄位不動。
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => onOpenChange(false)}
                  >
                    取消
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSave}
                    disabled={submitting || method === info.paymentMethod}
                  >
                    {submitting ? "儲存中..." : "儲存更正"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
