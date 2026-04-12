import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import path from 'path'

// 資料庫檔案路徑
const dbPath = path.join(process.cwd(), 'data', 'ai-cash.db')

// 建立 SQLite 連線
const sqlite = new Database(dbPath)

// 啟用 WAL 模式提升效能
sqlite.pragma('journal_mode = WAL')
// 啟用外鍵約束
sqlite.pragma('foreign_keys = ON')

// 建立 Drizzle ORM 實例
export const db = drizzle(sqlite, { schema })

export default db
