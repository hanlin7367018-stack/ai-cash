"use client"

import { useEffect } from "react"

// 進入頁面後延遲自動彈出列印對話框，並綁定工具列按鈕
export function PrintTrigger() {
  useEffect(() => {
    // 等瀏覽器渲染完再列印，避免排版尚未完成
    const timer = setTimeout(() => {
      window.print()
    }, 500)

    // 工具列按鈕手動列印
    const btn = document.getElementById("printBtn")
    const handler = () => window.print()
    btn?.addEventListener("click", handler)

    return () => {
      clearTimeout(timer)
      btn?.removeEventListener("click", handler)
    }
  }, [])

  return null
}
