"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
  HandCoins,
  Wallet,
  Users,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react"
import { formatCurrency } from "@/lib/date-utils"

interface PeriodSummary {
  id: number
  periodName: string
  totalHouseholds: number
  paidCount: number
  unpaidCount: number
  totalCollected: number
  cashAmount: number
  transferAmount: number
  pendingCash: number
}

interface PaymentRecord {
  id: number
  unitCode: string
  ownerName: string
  totalAmount: number
  paymentMethod: string
  paymentDate: string
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<PeriodSummary | null>(null)
  const [cashBalance, setCashBalance] = useState(0)
  const [recentPayments, setRecentPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // 取得目前期別
      const periodsRes = await fetch("/api/periods")
      const periods = await periodsRes.json()
      const currentPeriod = periods.find((p: { status: string }) => p.status === "open")

      if (currentPeriod) {
        // 取得期別統計
        const summaryRes = await fetch(`/api/periods/${currentPeriod.id}`)
        const summary = await summaryRes.json()
        setPeriod(summary)
      }

      // 取得手持現金
      const balanceRes = await fetch("/api/cash/balance")
      const balanceData = await balanceRes.json()
      setCashBalance(balanceData.balance)

      // 取得最近收款
      const paymentsRes = await fetch("/api/payments?limit=5")
      const paymentsData = await paymentsRes.json()
      setRecentPayments(paymentsData)
    } catch (err) {
      console.error("載入資料失敗", err)
    } finally {
      setLoading(false)
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

  const paidPercent = period
    ? Math.round((period.paidCount / period.totalHouseholds) * 100)
    : 0

  return (
    <AppShell>
      {/* 頁面標題 */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">儀表板</h2>
        <p className="text-sm text-gray-500 mt-1">
          {period ? period.periodName : "尚無開放期別"}
        </p>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* 收繳進度 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">已繳</p>
                <p className="text-2xl font-bold text-green-600">
                  {period?.paidCount ?? 0}
                  <span className="text-sm font-normal text-gray-400">
                    /{period?.totalHouseholds ?? 0}戶
                  </span>
                </p>
              </div>
            </div>
            {/* 進度條 */}
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${paidPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{paidPercent}%</p>
          </CardContent>
        </Card>

        {/* 未繳住戶 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">未繳</p>
                <p className="text-2xl font-bold text-red-600">
                  {period?.unpaidCount ?? 0}
                  <span className="text-sm font-normal text-gray-400">戶</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 已收金額 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <HandCoins className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">已收金額</p>
                <p className="text-xl font-bold text-gray-900">
                  ${formatCurrency(period?.totalCollected ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 手持現金 */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Wallet className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-amber-700">手持現金</p>
                <p className="text-xl font-bold text-amber-800">
                  ${formatCurrency(cashBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 快速操作 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Link href="/collect">
          <Button className="w-full h-12 text-base" size="lg">
            <HandCoins className="mr-2 h-5 w-5" />
            收款作業
          </Button>
        </Link>
        <Link href="/cash">
          <Button variant="outline" className="w-full h-12 text-base" size="lg">
            <Wallet className="mr-2 h-5 w-5" />
            幣別盤點
          </Button>
        </Link>
        <Link href="/reports">
          <Button variant="outline" className="w-full h-12 text-base" size="lg">
            <Users className="mr-2 h-5 w-5" />
            未繳清單
          </Button>
        </Link>
      </div>

      {/* 最近收款 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">最近收款</CardTitle>
          <Link href="/reports" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            查看全部 <ArrowRight className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentPayments.length === 0 ? (
            <p className="text-gray-400 text-center py-8">尚無收款記錄</p>
          ) : (
            <div className="space-y-3">
              {recentPayments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                      {p.unitCode}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.ownerName}</p>
                      <p className="text-xs text-gray-400">{p.paymentDate}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">${formatCurrency(p.totalAmount)}</p>
                    <Badge variant={p.paymentMethod === "cash" ? "default" : "secondary"} className="text-xs">
                      {p.paymentMethod === "cash" ? "現金" : "轉帳"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  )
}
