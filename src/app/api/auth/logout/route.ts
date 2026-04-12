import { NextResponse } from 'next/server'
import { clearAuthCookie } from '@/lib/auth'

// 登出
export async function POST() {
  await clearAuthCookie()
  return NextResponse.json({ success: true })
}
