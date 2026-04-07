import { NextResponse } from "next/server";
import {
  deleteSession,
  getSessionTokenFromRequest,
} from "@/services/sessionStore";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: Request) {
  const token = getSessionTokenFromRequest(request);
  if (token) {
    await deleteSession(token);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("ziwei_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

