import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import path from 'path'

// 靜態檔案服務 - 提供上傳的照片
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params

  // 安全檢查：不允許路徑穿越
  if (segments.some((s) => s.includes('..'))) {
    return NextResponse.json({ error: '無效路徑' }, { status: 400 })
  }

  const filePath = path.join(process.cwd(), 'uploads', ...segments)

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: '檔案不存在' }, { status: 404 })
  }

  try {
    const fileBuffer = readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const contentType =
      ext === '.png' ? 'image/png' :
      ext === '.gif' ? 'image/gif' :
      ext === '.webp' ? 'image/webp' :
      'image/jpeg'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: '讀取失敗' }, { status: 500 })
  }
}
