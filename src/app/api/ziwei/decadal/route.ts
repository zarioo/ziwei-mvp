/**
 * 这个文件负责大限接口：根据出生信息与大限索引返回大限详细结构。
 * 这样做是为了把大限数据拆分查询，避免一次性返回过多数据。
 */
import { NextResponse } from "next/server";
import { ZiweiDecadalSchema, getNatalAstrolabe } from "@/services/iztro";
import { mapDecadal } from "@/services/mapper";
import { checkRateLimit } from "@/services/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 10;

/**
 * 输入字段：
 * - calendar: "solar" | "lunar"
 * - date: "YYYY-M-D"
 * - timeIndex: number (0-12)
 * - gender: "男" | "女"
 * - daxianIndex: number
 *
 * 输出字段（简短）：
 * - index/startAge/endAge/palace/tianGan/dizhi/sihua/stars
 *
 * 返回示例：
 * {
 *   "index": 3,
 *   "startAge": 22,
 *   "endAge": 31,
 *   "palace": "夫妻宫"
 * }
 */
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
  const parsed = ZiweiDecadalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数校验失败", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const astrolabe = getNatalAstrolabe(parsed.data);
  const data = mapDecadal(astrolabe, parsed.data.daxianIndex);
  return NextResponse.json(data, {
    headers: {
      "X-RateLimit-Remaining": String(rate.remaining),
      "X-RateLimit-Reset": String(rate.resetAt),
    },
  });
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "0.0.0.0";
}

