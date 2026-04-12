"use client"

import { Sidebar } from "./sidebar"
import { MobileNav, MobileHeader } from "./mobile-nav"

// 已登入後的共用外殼佈局
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* 桌面側邊欄 */}
      <Sidebar />

      {/* 手機頂部列 */}
      <MobileHeader />

      {/* 主內容區 */}
      <main className="md:ml-60 pb-20 md:pb-6">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>

      {/* 手機底部導航 */}
      <MobileNav />
    </div>
  )
}
