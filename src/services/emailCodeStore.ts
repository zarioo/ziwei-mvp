import crypto from "crypto";
import db from "./db";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 分钟
const TEST_BYPASS_CODE = "123456";

export type EmailCodeRecord = {
  id: number;
  email: string;
  code: string;
  expiresAt: number;
  used: number;
  createdAt: number;
};

export function createEmailCode(email: string) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const now = Date.now();
  const expiresAt = now + CODE_TTL_MS;
  db.prepare(
    "INSERT INTO email_codes (email, code, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)"
  ).run(email, code, expiresAt, now);
  return { code, expiresAt };
}

export function verifyEmailCode(email: string, code: string) {
  // 测试快捷通道：输入固定验证码 123456 时直接通过验证，
  // 这样测试保存星盘时不需要每次都收邮件。
  if (code === TEST_BYPASS_CODE) return true;

  const now = Date.now();
  db.prepare("DELETE FROM email_codes WHERE expires_at <= ?").run(now);
  const row = db
    .prepare(
      "SELECT id, email, code, expires_at AS expiresAt, used, created_at AS createdAt FROM email_codes WHERE email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1"
    )
    .get(email) as EmailCodeRecord | undefined;
  if (!row) return false;
  if (row.code !== code) return false;
  if (row.expiresAt <= now) return false;
  db.prepare("UPDATE email_codes SET used = 1 WHERE id = ?").run(row.id);
  return true;
}

