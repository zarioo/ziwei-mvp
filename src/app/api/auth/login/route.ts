import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST() {
  // 这个接口已迁移到邮箱验证码流程，保留是为了兼容旧调用
  return NextResponse.json(
    { error: "登录方式已升级，请先发送验证码再验证登录。" },
    { status: 410 }
  );
}

