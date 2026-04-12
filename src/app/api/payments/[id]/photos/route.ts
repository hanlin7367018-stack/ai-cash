import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { payments } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// 上傳收據照片
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const paymentId = Number(id)

    // 取得繳費記錄
    const payment = await db.select().from(payments).where(eq(payments.id, paymentId)).get()
    if (!payment) {
      return NextResponse.json({ error: '找不到繳費記錄' }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: '請選擇照片' }, { status: 400 })
    }

    // 建立目錄
    const dir = path.join(process.cwd(), 'uploads', 'receipts', String(payment.periodId), String(paymentId))
    await mkdir(dir, { recursive: true })

    // 儲存照片
    const filename = `${Date.now()}.jpg`
    const filepath = path.join(dir, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filepath, buffer)

    // 更新照片路徑
    const photoUrl = `/api/uploads/receipts/${payment.periodId}/${paymentId}/${filename}`
    const existingPhotos: string[] = payment.receiptPhotos
      ? JSON.parse(payment.receiptPhotos)
      : []
    existingPhotos.push(photoUrl)

    await db.update(payments)
      .set({ receiptPhotos: JSON.stringify(existingPhotos) })
      .where(eq(payments.id, paymentId))
      .run()

    return NextResponse.json({ url: photoUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '上傳失敗'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
