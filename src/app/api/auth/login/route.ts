import { NextRequest, NextResponse } from 'next/server'
import { compareSync } from 'bcryptjs'
import db from '@/db'
import { users } from '@/db/schema'
import { createToken } from '@/lib/auth'
import { eq } from 'drizzle-orm'

const TOKEN_NAME = 'ai-cash-token'

// 登入
export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: '請輸入帳號和密碼' }, { status: 400 })
    }

    const user = await db.select().from(users).where(eq(users.username, username)).get()
    if (!user || !compareSync(password, user.passwordHash)) {
      return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
    }

    const token = await createToken({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    })

    // 直接在回應物件上設定 cookie（比 cookies() API 更可靠）
    const response = NextResponse.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    })
    response.cookies.set(TOKEN_NAME, token, {
      httpOnly: true,
      secure: false, // 開發環境允許 HTTP
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/',
    })
    return response
  } catch (err) {
    console.error('登入錯誤:', err)
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 })
  }
}
