import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

// 建立 Turso/LibSQL 連線
const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// 建立 Drizzle ORM 實例
export const db = drizzle(client, { schema })

export default db
