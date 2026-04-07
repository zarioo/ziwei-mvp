import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyEmailCode } from "@/services/emailCodeStore";
import { createSession } from "@/services/sessionStore";

export const runtime = "nodejs";
export const maxDuration = 10;

const VerifySchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  code: z.string().length(6, "验证码必须是6位"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数校验失败", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ok = verifyEmailCode(parsed.data.email, parsed.data.code);
  if (!ok) {
    return NextResponse.json({ error: "验证码无效或已过期" }, { status: 401 });
  }

  const session = await createSession(parsed.data.email);
  const response = NextResponse.json({ email: parsed.data.email });
  response.cookies.set("ziwei_session", session.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

