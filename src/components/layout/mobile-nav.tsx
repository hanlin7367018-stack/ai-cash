"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  HandCoins,
  Wallet,
  FileBarChart,
  Menu,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Sidebar } from "./sidebar"

// 手機底部導航（只顯示最常用的 4 個）
const mobileNavItems = [
  { href: "/dashboard", label: "首頁", icon: LayoutDashboard },
  { href: "/collect", label: "收款", icon: HandCoins },
  { href: "/cash", label: "現金", icon: Wallet },
  { href: "/reports", label: "報表", icon: FileBarChart },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="grid grid-cols-4 h-16">
        {mobileNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                isActive
                  ? "text-blue-700"
                  : "text-gray-500"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// 手機版頂部列
export function MobileHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="md:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200 sticky top-0 z-40">
      <h1 className="text-base font-bold text-gray-900">社區</h1>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="p-2 rounded-lg hover:bg-gray-100">
          <Menu className="h-5 w-5 text-gray-600" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-60">
          <SheetTitle className="sr-only">導航選單</SheetTitle>
          <Sidebar />
        </SheetContent>
      </Sheet>
    </header>
  )
}
