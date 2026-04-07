import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "ziwei.db");

function ensureDbDir() {
  // 确保数据库目录存在，避免首次运行时报错
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function initDb(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_email_codes_email
      ON email_codes(email);

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_email
      ON sessions(email);

    CREATE TABLE IF NOT EXISTS charts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      form_json TEXT NOT NULL,
      input_json TEXT NOT NULL,
      result_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_charts_email
      ON charts(email);
  `);
}

ensureDbDir();
const db = new Database(DB_PATH);
initDb(db);

export default db;

