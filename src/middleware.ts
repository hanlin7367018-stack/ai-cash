import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// JWT 密鑰（與 src/lib/auth.ts 保持一致）
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'ai-cash-secret-key-change-in-production'
)

const TOKEN_NAME = 'ai-cash-token'

// 不需登入就可以存取的路徑
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
]

// 判斷路徑是否為公開路徑
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'))
}

// 驗證 token 是否有效
async function isValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false
  try {
    await jwtVerify(token, JWT_SECRET)
    return true
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 公開路徑直接放行
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // 取得 token 並驗證
  const token = req.cookies.get(TOKEN_NAME)?.value
  const valid = await isValidToken(token)

  if (valid) {
    return NextResponse.next()
  }

  // API 路徑回 401
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  // 頁面路徑重定向到登入頁
  const loginUrl = new URL('/login', req.url)
  return NextResponse.redirect(loginUrl)
}

// 套用範圍：排除 Next.js 內部資源、靜態檔案和圖示
export const config = {
  matcher: [
    /*
     * 套用到所有路徑，除了：
     * - _next/static（靜態檔案）
     * - _next/image（圖片最佳化）
     * - favicon.ico
     * - 檔案副檔名（如 .png、.jpg 等）
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)',
  ],
}
