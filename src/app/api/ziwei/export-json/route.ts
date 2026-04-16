import { NextResponse } from "next/server";
import { checkRateLimit } from "@/services/ratelimit";
import {
  exportHoroscopeJson,
  HoroscopeExportError,
  HoroscopeExportSchema,
} from "@/services/horoscopeExport";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = Number(process.env.ZIWEI_RATE_LIMIT_PER_MIN ?? "30");
  const rate = checkRateLimit(ip, limit, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试。", resetAt: rate.resetAt },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = HoroscopeExportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数校验失败", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { fileName } = await exportHoroscopeJson(parsed.data);
    return NextResponse.json(
      {
        success: true,
        fileName,
        message: "后端运势 JSON 文件保存成功",
      },
      {
        headers: {
          "X-RateLimit-Remaining": String(rate.remaining),
          "X-RateLimit-Reset": String(rate.resetAt),
        },
      }
    );
  } catch (error) {
    if (error instanceof HoroscopeExportError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("后端生成运势 JSON 失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "生成失败",
      },
      { status: 500 }
    );
  }
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "0.0.0.0";
}
