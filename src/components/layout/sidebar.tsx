"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  HandCoins,
  ClipboardList,
  Users,
  CalendarDays,
  Wallet,
  FileBarChart,
  Settings,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"

// 導航項目定義
const navItems = [
  { href: "/dashboard", label: "儀表板", icon: LayoutDashboard },
  { href: "/collect", label: "收款作業", icon: HandCoins },
  { href: "/adhoc", label: "臨時收費", icon: ClipboardList },
  { href: "/households", label: "住戶管理", icon: Users },
  { href: "/periods", label: "期別管理", icon: CalendarDays },
  { href: "/cash", label: "現金管理", icon: Wallet },
  { href: "/reports", label: "報表中心", icon: FileBarChart },
]

export function Sidebar() {
  const pathname = usePathname()

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-gray-200">
      {/* 標題 */}
      <div className="flex items-center h-16 px-4 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">
          社區
        </h1>
      </div>

      {/* 導航連結 */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* 底部操作 */}
      <div className="border-t border-gray-200 px-3 py-3 space-y-1">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <Settings className="h-5 w-5 shrink-0" />
          系統設定
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors w-full"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          登出
        </button>
      </div>
    </aside>
  )
}
