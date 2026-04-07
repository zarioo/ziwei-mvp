import { NextResponse } from "next/server";
import {
  getSessionByToken,
  getSessionTokenFromRequest,
} from "@/services/sessionStore";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(request: Request) {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    // 没有登录也返回 200，避免前端控制台出现 401 报错
    return NextResponse.json({ loggedIn: false, email: null });
  }

  const session = await getSessionByToken(token);
  if (!session) {
    // 会话过期也返回 200，前端可根据 loggedIn 判断
    return NextResponse.json({ loggedIn: false, email: null });
  }

  return NextResponse.json({ loggedIn: true, email: session.email });
}

