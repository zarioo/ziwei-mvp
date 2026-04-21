import { NextResponse } from "next/server";
import { checkRateLimit } from "@/services/ratelimit";
import { saveJsonPayload } from "@/services/horoscopeExport";
import { generateLifeScript } from "@/services/life-script";
import { buildAndSaveLifeScriptSource } from "@/services/life-script/source";

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

  try {
    const debug = body?.debug === true;
    const { sourcePayload, sourceFileName, resultFileBaseName } =
      await buildAndSaveLifeScriptSource(body);
    const result = await generateLifeScript(sourcePayload, { debug });
    const resultFileName = await saveJsonPayload(
      result as Record<string, unknown>,
      resultFileBaseName
    );

    return NextResponse.json(
      {
        success: true,
        sourceFileName,
        resultFileName,
        result,
        message: "人生剧本评分结果已保存",
      },
      {
        headers: {
          "X-RateLimit-Remaining": String(rate.remaining),
          "X-RateLimit-Reset": String(rate.resetAt),
        },
      }
    );
  } catch (error) {
    console.error("生成人生剧本失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "生成人生剧本失败",
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
