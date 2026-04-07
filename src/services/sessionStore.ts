import crypto from "crypto";
import db from "./db";

type SessionRecord = {
  token: string;
  email: string;
  expiresAt: number;
};

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

export async function createSession(email: string) {
  const token = crypto.randomUUID();
  const record: SessionRecord = {
    token,
    email,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  db.prepare(
    "INSERT INTO sessions (token, email, expires_at) VALUES (?, ?, ?)"
  ).run(record.token, record.email, record.expiresAt);
  return record;
}

export async function getSessionByToken(token: string) {
  const now = Date.now();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  const row = db
    .prepare("SELECT token, email, expires_at AS expiresAt FROM sessions WHERE token = ?")
    .get(token) as SessionRecord | undefined;
  return row ?? null;
}

export async function deleteSession(token: string) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function getSessionTokenFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = cookieHeader.split(";").map((item) => item.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith("ziwei_session=")) {
      return cookie.replace("ziwei_session=", "");
    }
  }
  return null;
}

