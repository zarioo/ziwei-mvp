import { NextResponse } from "next/server";
import { z } from "zod";
import { createEmailCode } from "@/services/emailCodeStore";
import { sendLoginCodeEmail } from "@/services/email";

export const runtime = "nodejs";
export const maxDuration = 10;

const EmailSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = EmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "邮箱格式不正确", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { code } = createEmailCode(parsed.data.email);
  try {
    await sendLoginCodeEmail(parsed.data.email, code);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "发送验证码失败" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

