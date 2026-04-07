import { NextResponse } from "next/server";
import { z } from "zod";
import { ZiweiBaseSchema, getNatalAstrolabe, getHoroscope } from "@/services/iztro";
import { checkRateLimit } from "@/services/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 10;

const HoroscopeSchema = ZiweiBaseSchema.extend({
  targetDate: z.string().min(1),
  targetHour: z.number().int().min(0).max(12),
});

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
  const parsed = HoroscopeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数校验失败", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const toPlain = (value: unknown) => {
    const seen = new WeakSet();
    return JSON.parse(
      JSON.stringify(value, (key, val) => {
        if (key === "_astrolabe") return undefined;
        if (typeof val === "object" && val !== null) {
          if (seen.has(val as object)) return undefined;
          seen.add(val as object);
        }
        return val;
      })
    );
  };

  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "H5",
      location: "src/app/api/ziwei/horoscope/route.ts:POST:input",
      message: "horoscope input parsed",
      data: { targetDate: parsed.data.targetDate, targetHour: parsed.data.targetHour },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

  const { targetDate, targetHour, ...base } = parsed.data;
  const astrolabe = getNatalAstrolabe(base);
  const horoscope = getHoroscope(astrolabe, new Date(targetDate), targetHour);
  const rawHoroscope = toPlain(horoscope);

  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "H6",
      location: "src/app/api/ziwei/horoscope/route.ts:POST:payload",
      message: "horoscope response payload size",
      data: { horoscopeSize: JSON.stringify(rawHoroscope).length },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

  return NextResponse.json(
    { rawHoroscope },
    {
      headers: {
        "X-RateLimit-Remaining": String(rate.remaining),
        "X-RateLimit-Reset": String(rate.resetAt),
      },
    }
  );
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "0.0.0.0";
}

