import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

// 取得目前使用者
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }
  return NextResponse.json(user)
}
