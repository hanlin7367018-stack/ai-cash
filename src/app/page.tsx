import { redirect } from "next/navigation"

// 首頁直接導向儀表板
export default function Home() {
  redirect("/dashboard")
}
