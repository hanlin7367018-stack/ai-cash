"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { AlertCircle, CheckCircle2, ArrowRightLeft, AlertTriangle, FileSpreadsheet, Pencil } from "lucide-react"
import { formatCurrency } from "@/lib/date-utils"
import { paymentStatusLabel, paymentStatusVariant, periodOfDate } from "@/lib/payment-status"
import { PaymentMethodDialog, type PaymentKind } from "@/components/payment-method-dialog"

interface Period {
  id: number
  periodName: string
  status: string
  rocYear: number
  startMonth: number
  endMonth: number
}

// 臨時收費繳費記錄（無期別欄位，期別由收款日期換算）
interface AdhocPaymentItem {
  id: number
  unitCode: string
  ownerName: string
  projectName: string
  totalAmount: number
  paymentMethod: string
  paymentDate: string
  handoverStatus: string
}

interface UnpaidItem {
  id: number
  unitCode: string
  ownerName: string
  managementFee: number
  carParkingFee: number
  motorParkingFee: number
  cardFee: number
  cableTvFee: number
  sensorFee: number
  totalDue: number
}

interface PaymentItem {
  id: number
  unitCode: string
  ownerName: string
  totalAmount: number
  paymentMethod: string
  paymentDate: string
  receiptNumber: string
  handoverStatus: string
}

interface CrossPeriodUnpaidItem {
  id: number
  unitCode: string
  ownerName: string
  unpaidPeriods: { periodId: number; periodName: string; amount: number }[]
  unpaidCount: number
  totalDue: number
}

interface HandoverItem {
  id: number
  handoverDate: string
  totalCount: number
  totalAmount: number
  denominationTotal: number
  receiverName: string
  handoverBy: string
  bill2000: number
  bill1000: number
  bill500: number
  bill200: number
  coin100: number
  coin50: number
  coin20: number
  coin10: number
  coin5: number
  coin1: number
}

export default function ReportsPage() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string>("")
  const [unpaidList, setUnpaidList] = useState<UnpaidItem[]>([])
  const [paymentList, setPaymentList] = useState<PaymentItem[]>([])
  const [handoverList, setHandoverList] = useState<HandoverItem[]>([])
  const [crossPeriodUnpaid, setCrossPeriodUnpaid] = useState<CrossPeriodUnpaidItem[]>([])
  const [adhocAll, setAdhocAll] = useState<AdhocPaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  // 更正付款方式視窗
  const [correctOpen, setCorrectOpen] = useState(false)
  const [correctKind, setCorrectKind] = useState<PaymentKind>("payment")
  const [correctPaymentId, setCorrectPaymentId] = useState<number | null>(null)

  // 開啟更正視窗
  const openCorrect = (kind: PaymentKind, id: number) => {
    setCorrectKind(kind)
    setCorrectPaymentId(id)
    setCorrectOpen(true)
  }

  useEffect(() => {
    loadPeriods()
  }, [])

  useEffect(() => {
    if (selectedPeriod) {
      loadReportData(selectedPeriod)
    }
  }, [selectedPeriod])

  const loadPeriods = async () => {
    try {
      const [periodsRes, crossRes] = await Promise.all([
        fetch("/api/periods"),
        fetch("/api/payments/unpaid-all"),
      ])
      const data = await periodsRes.json()
      setPeriods(data)
      setCrossPeriodUnpaid(await crossRes.json())
      const open = data.find((p: Period) => p.status === "open")
      if (open) setSelectedPeriod(open.id.toString())
    } catch {
      toast.error("載入期別失敗")
    } finally {
      setLoading(false)
    }
  }

  const loadReportData = async (periodId: string) => {
    try {
      const [unpaidRes, paymentsRes, handoversRes, adhocRes] = await Promise.all([
        fetch(`/api/payments/unpaid?periodId=${periodId}`),
        fetch(`/api/payments?periodId=${periodId}`),
        fetch("/api/cash/handovers"),
        fetch("/api/adhoc-payments"),
      ])
      setUnpaidList(await unpaidRes.json())
      setPaymentList(await paymentsRes.json())
      setAdhocAll(adhocRes.ok ? await adhocRes.json() : [])
      setHandoverList(await handoversRes.json())
    } catch {
      toast.error("載入報表失敗")
    }
  }

  // 臨時收費沒有期別欄位，依收款日期換算後對應到目前選定的期別
  const currentPeriod = periods.find((p) => p.id === Number(selectedPeriod))
  const adhocInPeriod = currentPeriod
    ? adhocAll.filter((a) => {
        const d = periodOfDate(a.paymentDate)
        return (
          d.rocYear === currentPeriod.rocYear &&
          d.startMonth === currentPeriod.startMonth
        )
      })
    : []
  const adhocTotal = adhocInPeriod.reduce((s, a) => s + a.totalAmount, 0)

  // 計算統計
  const totalCollected = paymentList.reduce((s, p) => s + p.totalAmount, 0)
  const cashTotal = paymentList.filter((p) => p.paymentMethod === "cash").reduce((s, p) => s + p.totalAmount, 0)
  const transferTotal = paymentList.filter((p) => p.paymentMethod === "transfer").reduce((s, p) => s + p.totalAmount, 0)
  const unpaidTotal = unpaidList.reduce((s, u) => s + u.totalDue, 0)

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">報表中心</h2>
        </div>
        <Select value={selectedPeriod} onValueChange={(v) => v && setSelectedPeriod(v)}>
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

      {/* 統計摘要 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500">收繳進度</p>
            <p className="text-xl font-bold">
              <span className="text-green-600">{paymentList.length}</span>
              <span className="text-gray-400 text-sm"> / {paymentList.length + unpaidList.length} 戶</span>
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              未繳 {unpaidList.length} 戶
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500">已收總額</p>
            <p className="text-xl font-bold">${formatCurrency(totalCollected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500">現金</p>
            <p className="text-xl font-bold text-green-600">${formatCurrency(cashTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500">轉帳</p>
            <p className="text-xl font-bold text-blue-600">${formatCurrency(transferTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500">未繳總額</p>
            <p className="text-xl font-bold text-red-600">${formatCurrency(unpaidTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="unpaid">
        <TabsList className="mb-4">
          <TabsTrigger value="unpaid" className="gap-1">
            <AlertCircle className="h-4 w-4" /> 未繳清單
          </TabsTrigger>
          <TabsTrigger value="collection" className="gap-1">
            <CheckCircle2 className="h-4 w-4" /> 收款明細
          </TabsTrigger>
          <TabsTrigger value="handover" className="gap-1">
            <ArrowRightLeft className="h-4 w-4" /> 交付明細
          </TabsTrigger>
          <TabsTrigger value="cross-period" className="gap-1">
            <AlertTriangle className="h-4 w-4" /> 跨期欠繳
          </TabsTrigger>
        </TabsList>

        {/* 未繳清單 */}
        <TabsContent value="unpaid">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg text-red-600">
                未繳清單（{unpaidList.length} 戶）
              </CardTitle>
              {unpaidList.length > 0 && selectedPeriod && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    window.open(`/api/reports/export-excel?type=unpaid&periodId=${selectedPeriod}`, "_blank")
                  }
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  匯出 Excel
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {unpaidList.length === 0 ? (
                <p className="text-center text-gray-400 py-8">全部已繳！</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>棟號</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">管理費</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">停車費</TableHead>
                      <TableHead className="text-right">應繳</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unpaidList.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-bold">{u.unitCode}</TableCell>
                        <TableCell>{u.ownerName}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          ${formatCurrency(u.managementFee)}
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          ${formatCurrency(u.carParkingFee)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-600">
                          ${formatCurrency(u.totalDue)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-bold">
                      <TableCell colSpan={4}>合計</TableCell>
                      <TableCell className="text-right text-red-600">
                        ${formatCurrency(unpaidTotal)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 收款明細 */}
        <TabsContent value="collection">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                收款明細（{paymentList.length} 筆）
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {paymentList.length === 0 ? (
                <p className="text-center text-gray-400 py-8">尚無收款記錄</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>單號</TableHead>
                      <TableHead>棟號</TableHead>
                      <TableHead className="hidden sm:table-cell">姓名</TableHead>
                      <TableHead>方式</TableHead>
                      <TableHead className="hidden sm:table-cell">日期</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentList.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs font-mono">{p.receiptNumber}</TableCell>
                        <TableCell className="font-bold">{p.unitCode}</TableCell>
                        <TableCell className="hidden sm:table-cell">{p.ownerName}</TableCell>
                        <TableCell>
                          <Badge variant={p.paymentMethod === "cash" ? "default" : "secondary"} className="text-xs">
                            {p.paymentMethod === "cash" ? "現金" : "轉帳"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">{p.paymentDate}</TableCell>
                        <TableCell className="text-right font-medium">
                          ${formatCurrency(p.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={paymentStatusVariant(p.paymentMethod, p.handoverStatus)}
                            className="text-xs"
                          >
                            {paymentStatusLabel(p.paymentMethod, p.handoverStatus)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => openCorrect("payment", p.id)}
                            title="更正付款方式"
                            className="p-1.5 rounded hover:bg-gray-100"
                          >
                            <Pencil className="h-4 w-4 text-gray-400" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-bold">
                      <TableCell colSpan={5}>合計</TableCell>
                      <TableCell className="text-right">
                        ${formatCurrency(totalCollected)}
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          {/* 臨時收費（依收款日期歸入本期） */}
          {adhocInPeriod.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg">
                  臨時收費（{adhocInPeriod.length} 筆）
                </CardTitle>
                <p className="text-xs text-gray-400">依收款日期歸入本期</p>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>收費專案</TableHead>
                      <TableHead>棟號</TableHead>
                      <TableHead className="hidden sm:table-cell">姓名</TableHead>
                      <TableHead>方式</TableHead>
                      <TableHead className="hidden sm:table-cell">日期</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adhocInPeriod.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs">{a.projectName}</TableCell>
                        <TableCell className="font-bold">{a.unitCode}</TableCell>
                        <TableCell className="hidden sm:table-cell">{a.ownerName}</TableCell>
                        <TableCell>
                          <Badge
                            variant={a.paymentMethod === "cash" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {a.paymentMethod === "cash" ? "現金" : "轉帳"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">
                          {a.paymentDate}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${formatCurrency(a.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={paymentStatusVariant(a.paymentMethod, a.handoverStatus)}
                            className="text-xs"
                          >
                            {paymentStatusLabel(a.paymentMethod, a.handoverStatus)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => openCorrect("adhoc", a.id)}
                            title="更正付款方式"
                            className="p-1.5 rounded hover:bg-gray-100"
                          >
                            <Pencil className="h-4 w-4 text-gray-400" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-bold">
                      <TableCell colSpan={5}>合計</TableCell>
                      <TableCell className="text-right">
                        ${formatCurrency(adhocTotal)}
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 交付明細 */}
        <TabsContent value="handover">
          <div className="space-y-4">
            {handoverList.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-gray-400">尚無交付記錄</p>
                </CardContent>
              </Card>
            ) : (
              handoverList.map((h) => {
                const denomData = [
                  { label: "2,000元", count: h.bill2000, value: 2000 },
                  { label: "1,000元", count: h.bill1000, value: 1000 },
                  { label: "500元", count: h.bill500, value: 500 },
                  { label: "200元", count: h.bill200, value: 200 },
                  { label: "100元", count: h.coin100, value: 100 },
                  { label: "50元", count: h.coin50, value: 50 },
                  { label: "20元", count: h.coin20, value: 20 },
                  { label: "10元", count: h.coin10, value: 10 },
                  { label: "5元", count: h.coin5, value: 5 },
                  { label: "1元", count: h.coin1, value: 1 },
                ].filter((d) => d.count > 0)

                return (
                  <Card key={h.id}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>交付日期：{h.handoverDate}</span>
                        <span className="text-lg text-blue-700">
                          ${formatCurrency(h.totalAmount)}
                        </span>
                      </CardTitle>
                      <p className="text-sm text-gray-500">
                        接收人：{h.receiverName} · 交付人：{h.handoverBy} · 共 {h.totalCount} 筆
                      </p>
                    </CardHeader>
                    {denomData.length > 0 && (
                      <CardContent>
                        <p className="text-sm font-medium mb-2">幣別明細</p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>面額</TableHead>
                              <TableHead className="text-center">數量</TableHead>
                              <TableHead className="text-right">小計</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {denomData.map((d) => (
                              <TableRow key={d.label}>
                                <TableCell>{d.label}</TableCell>
                                <TableCell className="text-center">{d.count}</TableCell>
                                <TableCell className="text-right">
                                  ${formatCurrency(d.count * d.value)}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-gray-50 font-bold">
                              <TableCell>合計</TableCell>
                              <TableCell />
                              <TableCell className="text-right">
                                ${formatCurrency(h.denominationTotal)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    )}
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        {/* 跨期欠繳 */}
        <TabsContent value="cross-period">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg text-amber-600">
                跨期欠繳（{crossPeriodUnpaid.length} 戶）
              </CardTitle>
              <p className="text-xs text-gray-400">統計所有收費中期別</p>
            </CardHeader>
            <CardContent className="p-0">
              {crossPeriodUnpaid.length === 0 ? (
                <p className="text-center text-green-600 py-8">全部已繳！</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>棟號</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead className="text-center">欠繳期數</TableHead>
                      <TableHead className="hidden sm:table-cell">欠繳期別</TableHead>
                      <TableHead className="text-right">合計金額</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {crossPeriodUnpaid.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-bold">{item.unitCode}</TableCell>
                        <TableCell>{item.ownerName}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={item.unpaidCount > 1 ? "destructive" : "outline"}>
                            {item.unpaidCount} 期
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-gray-500">
                          {item.unpaidPeriods.map((p) => p.periodName.replace(/月$/, "期")).join("、")}
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-600">
                          ${formatCurrency(item.totalDue)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-bold">
                      <TableCell colSpan={4}>合計</TableCell>
                      <TableCell className="text-right text-red-600">
                        ${formatCurrency(crossPeriodUnpaid.reduce((s, i) => s + i.totalDue, 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 更正付款方式 */}
      <PaymentMethodDialog
        open={correctOpen}
        onOpenChange={setCorrectOpen}
        kind={correctKind}
        paymentId={correctPaymentId}
        onUpdated={() => {
          if (selectedPeriod) loadReportData(selectedPeriod)
        }}
      />
    </AppShell>
  )
}
