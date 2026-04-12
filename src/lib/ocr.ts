import { createWorker } from 'tesseract.js'

/**
 * 從收據照片中辨識收費單編號（NO.XXXXXX 格式）
 * 使用 Tesseract.js client-side OCR
 */
export async function recognizeReceiptNumber(
  imageFile: File
): Promise<{ number: string | null; rawText: string }> {
  const worker = await createWorker('eng')
  try {
    const { data: { text } } = await worker.recognize(imageFile)

    // 嘗試匹配 NO.XXXXXX 格式（5-7 位數字）
    // 支援各種 OCR 誤讀：NO. / No. / N0. / 空格等
    const match = text.match(/[Nn][Oo0]\.?\s*(\d{5,7})/)
    const number = match ? `NO.${match[1]}` : null

    return { number, rawText: text }
  } finally {
    await worker.terminate()
  }
}
