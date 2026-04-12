import { createClient } from '@libsql/client'
import { hashSync } from 'bcryptjs'
import dotenv from 'dotenv'
import path from 'path'

// 載入 .env.local 環境變數
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

async function seed() {
  // 建立資料表
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS households (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_code TEXT NOT NULL UNIQUE,
      building TEXT NOT NULL,
      door_number INTEGER NOT NULL,
      owner_name TEXT NOT NULL,
      phone TEXT,
      management_fee INTEGER NOT NULL,
      car_parking_fee INTEGER NOT NULL DEFAULT 0,
      motor_parking_fee INTEGER NOT NULL DEFAULT 0,
      card_fee INTEGER NOT NULL DEFAULT 0,
      cable_tv_fee INTEGER NOT NULL DEFAULT 0,
      sensor_fee INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS billing_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roc_year INTEGER NOT NULL,
      start_month INTEGER NOT NULL,
      end_month INTEGER NOT NULL,
      period_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      household_id INTEGER NOT NULL REFERENCES households(id),
      period_id INTEGER NOT NULL REFERENCES billing_periods(id),
      receipt_number TEXT NOT NULL,
      management_fee INTEGER NOT NULL DEFAULT 0,
      car_parking_fee INTEGER NOT NULL DEFAULT 0,
      motor_parking_fee INTEGER NOT NULL DEFAULT 0,
      card_fee INTEGER NOT NULL DEFAULT 0,
      cable_tv_fee INTEGER NOT NULL DEFAULT 0,
      sensor_fee INTEGER NOT NULL DEFAULT 0,
      other_fee INTEGER NOT NULL DEFAULT 0,
      other_fee_note TEXT,
      total_amount INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      payment_date TEXT NOT NULL,
      receipt_photos TEXT,
      collector_name TEXT,
      handover_status TEXT NOT NULL DEFAULT 'pending',
      handover_id INTEGER,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS cash_handovers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL REFERENCES billing_periods(id),
      handover_date TEXT NOT NULL,
      total_count INTEGER NOT NULL,
      total_amount INTEGER NOT NULL,
      bill_2000 INTEGER NOT NULL DEFAULT 0,
      bill_1000 INTEGER NOT NULL DEFAULT 0,
      bill_500 INTEGER NOT NULL DEFAULT 0,
      bill_200 INTEGER NOT NULL DEFAULT 0,
      coin_100 INTEGER NOT NULL DEFAULT 0,
      coin_50 INTEGER NOT NULL DEFAULT 0,
      coin_20 INTEGER NOT NULL DEFAULT 0,
      coin_10 INTEGER NOT NULL DEFAULT 0,
      coin_5 INTEGER NOT NULL DEFAULT 0,
      coin_1 INTEGER NOT NULL DEFAULT 0,
      denomination_total INTEGER NOT NULL,
      receiver_name TEXT NOT NULL,
      handover_by TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS adhoc_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS adhoc_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES adhoc_projects(id),
      household_id INTEGER NOT NULL REFERENCES households(id),
      amount INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      payment_date TEXT NOT NULL,
      collector_name TEXT,
      handover_status TEXT NOT NULL DEFAULT 'pending',
      handover_id INTEGER,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'collector',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `)
  console.log('資料表建立完成')

  // 56 戶住戶資料（來自 AI-CASH.xlsx）
  const householdData = [
    // A 棟
    { unitCode: 'A-1', building: 'A', doorNumber: 1, ownerName: 'A-1住戶', managementFee: 5840, carParkingFee: 500 },
    { unitCode: 'A-2', building: 'A', doorNumber: 2, ownerName: 'A-2住戶', managementFee: 5860, carParkingFee: 500 },
    { unitCode: 'A-3', building: 'A', doorNumber: 3, ownerName: 'A-3住戶', managementFee: 5860, carParkingFee: 0 },
    { unitCode: 'A-4', building: 'A', doorNumber: 4, ownerName: 'A-4住戶', managementFee: 5860, carParkingFee: 1000 },
    { unitCode: 'A-5', building: 'A', doorNumber: 5, ownerName: 'A-5住戶', managementFee: 5860, carParkingFee: 500 },
    { unitCode: 'A-6', building: 'A', doorNumber: 6, ownerName: 'A-6住戶', managementFee: 5860, carParkingFee: 0 },
    { unitCode: 'A-7', building: 'A', doorNumber: 7, ownerName: 'A-7住戶', managementFee: 5860, carParkingFee: 700 },
    { unitCode: 'A-8', building: 'A', doorNumber: 8, ownerName: 'A-8住戶', managementFee: 5860, carParkingFee: 500 },
    // B 棟
    { unitCode: 'B-1', building: 'B', doorNumber: 1, ownerName: 'B-1住戶', managementFee: 6290, carParkingFee: 500 },
    { unitCode: 'B-2', building: 'B', doorNumber: 2, ownerName: 'B-2住戶', managementFee: 6390, carParkingFee: 0 },
    { unitCode: 'B-3', building: 'B', doorNumber: 3, ownerName: 'B-3住戶', managementFee: 6390, carParkingFee: 500 },
    { unitCode: 'B-4', building: 'B', doorNumber: 4, ownerName: 'B-4住戶', managementFee: 6390, carParkingFee: 500 },
    { unitCode: 'B-5', building: 'B', doorNumber: 5, ownerName: 'B-5住戶', managementFee: 6390, carParkingFee: 1000 },
    { unitCode: 'B-6', building: 'B', doorNumber: 6, ownerName: 'B-6住戶', managementFee: 6390, carParkingFee: 1000 },
    { unitCode: 'B-7', building: 'B', doorNumber: 7, ownerName: 'B-7住戶', managementFee: 6390, carParkingFee: 500 },
    { unitCode: 'B-8', building: 'B', doorNumber: 8, ownerName: 'B-8住戶', managementFee: 6390, carParkingFee: 500 },
    // C 棟
    { unitCode: 'C-1', building: 'C', doorNumber: 1, ownerName: 'C-1住戶', managementFee: 5170, carParkingFee: 500 },
    { unitCode: 'C-2', building: 'C', doorNumber: 2, ownerName: 'C-2住戶', managementFee: 5260, carParkingFee: 0 },
    { unitCode: 'C-3', building: 'C', doorNumber: 3, ownerName: 'C-3住戶', managementFee: 5260, carParkingFee: 0 },
    { unitCode: 'C-4', building: 'C', doorNumber: 4, ownerName: 'C-4住戶', managementFee: 5260, carParkingFee: 0 },
    { unitCode: 'C-5', building: 'C', doorNumber: 5, ownerName: 'C-5住戶', managementFee: 5260, carParkingFee: 500 },
    { unitCode: 'C-6', building: 'C', doorNumber: 6, ownerName: 'C-6住戶', managementFee: 5260, carParkingFee: 500 },
    { unitCode: 'C-7', building: 'C', doorNumber: 7, ownerName: 'C-7住戶', managementFee: 5260, carParkingFee: 500 },
    { unitCode: 'C-8', building: 'C', doorNumber: 8, ownerName: 'C-8住戶', managementFee: 5260, carParkingFee: 1000 },
    // D 棟
    { unitCode: 'D-1', building: 'D', doorNumber: 1, ownerName: 'D-1住戶', managementFee: 5250, carParkingFee: 500 },
    { unitCode: 'D-2', building: 'D', doorNumber: 2, ownerName: 'D-2住戶', managementFee: 5290, carParkingFee: 0 },
    { unitCode: 'D-3', building: 'D', doorNumber: 3, ownerName: 'D-3住戶', managementFee: 5290, carParkingFee: 500 },
    { unitCode: 'D-4', building: 'D', doorNumber: 4, ownerName: 'D-4住戶', managementFee: 5290, carParkingFee: 500 },
    { unitCode: 'D-5', building: 'D', doorNumber: 5, ownerName: 'D-5住戶', managementFee: 5200, carParkingFee: 0 },
    { unitCode: 'D-6', building: 'D', doorNumber: 6, ownerName: 'D-6住戶', managementFee: 5200, carParkingFee: 500 },
    { unitCode: 'D-7', building: 'D', doorNumber: 7, ownerName: 'D-7住戶', managementFee: 5200, carParkingFee: 1000 },
    { unitCode: 'D-8', building: 'D', doorNumber: 8, ownerName: 'D-8住戶', managementFee: 5200, carParkingFee: 500 },
    // E 棟
    { unitCode: 'E-1', building: 'E', doorNumber: 1, ownerName: 'E-1住戶', managementFee: 5090, carParkingFee: 500 },
    { unitCode: 'E-2', building: 'E', doorNumber: 2, ownerName: 'E-2住戶', managementFee: 5090, carParkingFee: 500 },
    { unitCode: 'E-3', building: 'E', doorNumber: 3, ownerName: 'E-3住戶', managementFee: 5090, carParkingFee: 500 },
    { unitCode: 'E-4', building: 'E', doorNumber: 4, ownerName: 'E-4住戶', managementFee: 5090, carParkingFee: 0 },
    { unitCode: 'E-5', building: 'E', doorNumber: 5, ownerName: 'E-5住戶', managementFee: 5090, carParkingFee: 500 },
    { unitCode: 'E-6', building: 'E', doorNumber: 6, ownerName: 'E-6住戶', managementFee: 5090, carParkingFee: 500 },
    { unitCode: 'E-7', building: 'E', doorNumber: 7, ownerName: 'E-7住戶', managementFee: 5090, carParkingFee: 500 },
    { unitCode: 'E-8', building: 'E', doorNumber: 8, ownerName: 'E-8住戶', managementFee: 5090, carParkingFee: 500 },
    // F 棟
    { unitCode: 'F-1', building: 'F', doorNumber: 1, ownerName: 'F-1住戶', managementFee: 5080, carParkingFee: 0 },
    { unitCode: 'F-2', building: 'F', doorNumber: 2, ownerName: 'F-2住戶', managementFee: 5080, carParkingFee: 1000 },
    { unitCode: 'F-3', building: 'F', doorNumber: 3, ownerName: 'F-3住戶', managementFee: 5080, carParkingFee: 500 },
    { unitCode: 'F-4', building: 'F', doorNumber: 4, ownerName: 'F-4住戶', managementFee: 5080, carParkingFee: 0 },
    { unitCode: 'F-5', building: 'F', doorNumber: 5, ownerName: 'F-5住戶', managementFee: 5080, carParkingFee: 500 },
    { unitCode: 'F-6', building: 'F', doorNumber: 6, ownerName: 'F-6住戶', managementFee: 5080, carParkingFee: 500 },
    { unitCode: 'F-7', building: 'F', doorNumber: 7, ownerName: 'F-7住戶', managementFee: 5080, carParkingFee: 0 },
    { unitCode: 'F-8', building: 'F', doorNumber: 8, ownerName: 'F-8住戶', managementFee: 5080, carParkingFee: 500 },
    // G 棟
    { unitCode: 'G-1', building: 'G', doorNumber: 1, ownerName: 'G-1住戶', managementFee: 6220, carParkingFee: 1000 },
    { unitCode: 'G-2', building: 'G', doorNumber: 2, ownerName: 'G-2住戶', managementFee: 6220, carParkingFee: 500 },
    { unitCode: 'G-3', building: 'G', doorNumber: 3, ownerName: 'G-3住戶', managementFee: 6220, carParkingFee: 500 },
    { unitCode: 'G-4', building: 'G', doorNumber: 4, ownerName: 'G-4住戶', managementFee: 6220, carParkingFee: 500 },
    { unitCode: 'G-5', building: 'G', doorNumber: 5, ownerName: 'G-5住戶', managementFee: 6220, carParkingFee: 500 },
    { unitCode: 'G-6', building: 'G', doorNumber: 6, ownerName: 'G-6住戶', managementFee: 6220, carParkingFee: 500 },
    { unitCode: 'G-7', building: 'G', doorNumber: 7, ownerName: 'G-7住戶', managementFee: 6220, carParkingFee: 1000 },
    { unitCode: 'G-8', building: 'G', doorNumber: 8, ownerName: 'G-8住戶', managementFee: 6220, carParkingFee: 500 },
  ]

  // 匯入住戶資料
  console.log('開始匯入住戶資料...')
  const tx = await client.transaction('write')
  try {
    for (const h of householdData) {
      await tx.execute({
        sql: `INSERT OR IGNORE INTO households (unit_code, building, door_number, owner_name, management_fee, car_parking_fee)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [h.unitCode, h.building, h.doorNumber, h.ownerName, h.managementFee, h.carParkingFee],
      })
    }
    await tx.commit()
  } catch (e) {
    await tx.rollback()
    throw e
  }
  console.log(`已匯入 ${householdData.length} 戶住戶資料`)

  // 建立預設管理員帳號
  const adminPassword = hashSync('admin123', 10)
  await client.execute({
    sql: `INSERT OR IGNORE INTO users (username, password_hash, display_name, role)
          VALUES (?, ?, ?, ?)`,
    args: ['admin', adminPassword, '系統管理員', 'admin'],
  })
  console.log('已建立預設管理員帳號：admin / admin123')

  // 建立預設期別（115年3-4月）
  await client.execute({
    sql: `INSERT OR IGNORE INTO billing_periods (roc_year, start_month, end_month, period_name, status)
          VALUES (?, ?, ?, ?, ?)`,
    args: [115, 3, 4, '115年3-4月', 'open'],
  })
  console.log('已建立預設期別：115年3-4月')

  console.log('資料庫初始化完成！')
}

seed().catch(console.error)
