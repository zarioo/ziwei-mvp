/**
 * 这个文件负责本命盘接口：接收出生信息并返回十二宫与索引摘要。
 * 这样做是为了把排盘逻辑集中在后端，前端只消费契约结构。
 */
import { NextResponse } from "next/server";
import { ZiweiBaseSchema, getNatalAstrolabe, getHoroscope } from "@/services/iztro";
import { mapNatal } from "@/services/mapper";
import { checkRateLimit } from "@/services/ratelimit";
import { writeJson } from "@/services/localStore";

export const runtime = "nodejs";
export const maxDuration = 10;

/**
 * 输入字段：
 * - calendar: "solar" | "lunar"
 * - date: "YYYY-M-D"
 * - timeIndex: number (0-12)
 * - gender: "男" | "女"
 * - fixLeap?: boolean
 * - isLeapMonth?: boolean
 * - language?: string
 *
 * 输出字段（简版）：
 * - 基础信息 + palaces(12) + sihua.bensheng
 * - daxian 索引摘要 + liunian 索引摘要
 *
 * 返回示例（简短）：
 * {
 *   "version": 1,
 *   "palaces": [ { "name": "命宫", "majorStars": [] } ],
 *   "daxian": [ { "index": 1, "startAge": 2 } ],
 *   "liunian": [ { "year": 1984, "palace": "命宫" } ]
 * }
 */
export async function POST(request: Request) {
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "H7",
      location: "src/app/api/ziwei/natal/route.ts:POST:entry",
      message: "natal handler entry",
      data: { hasBody: request.headers.get("content-length") },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

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
  const parsed = ZiweiBaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数校验失败", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "H2",
      location: "src/app/api/ziwei/natal/route.ts:POST:input",
      message: "natal input parsed",
      data: {
        date: parsed.data.date,
        timeIndex: parsed.data.timeIndex,
        gender: parsed.data.gender,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

  try {
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
    const astrolabe = getNatalAstrolabe(parsed.data);
    const data = mapNatal(astrolabe, parsed.data);

    // 使用出生时辰作为默认运限时辰，保证前端渲染一致
    const horoscopeDate = new Date();
    const horoscopeHour = parsed.data.timeIndex;
    const horoscope = getHoroscope(astrolabe, horoscopeDate, horoscopeHour);

    // 这里做一次 JSON 序列化，去掉方法，便于前端渲染
    const rawAstrolabe = toPlain(astrolabe);
    const rawHoroscope = toPlain(horoscope);

    // 打印接口输出的内容，方便后端调试和观察
    // 说明：控制台只显示关键摘要，详细数据会保存到文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logFileName = `api-natal-${timestamp}.json`;
    
    // 在控制台只打印关键摘要信息，避免输出过多
    console.log("\n========== 【后端】接口排盘 API 处理结果 ==========");
    console.log("📥 请求参数：", JSON.stringify(parsed.data));
    console.log("📊 映射后的简化数据摘要：");
    console.log(`   - 阳历：${data.solarBirthDate || "—"}`);
    console.log(`   - 阴历：${data.lunarBirthDate || "—"}`);
    console.log(`   - 五行局：${data.wuxingju || "—"}`);
    console.log(`   - 命主：${data.mingzhu || "—"}`);
    console.log(`   - 身主：${data.shenzhu || "—"}`);
    console.log(`   - 宫位数量：${data.palaces?.length || 0}`);
    console.log("📁 详细数据已保存到文件：", logFileName);
    console.log("   文件位置：data/" + logFileName);
    console.log("===========================================\n");

    // 将完整数据保存到文件，方便详细查看
    // 说明：这样可以在文件中查看完整数据，而不会让终端输出过多
    // 注意：JSON 格式不支持注释，所以使用 _description 和 _note 字段来说明各部分
    const fullResponse = {
      // 文件说明字段（以下划线开头，表示这是元数据说明）
      _fileDescription: "接口排盘 API 完整响应数据",
      _generatedAt: new Date().toISOString(),
      _note: "此文件包含一次排盘请求的完整数据，包括请求参数、映射后的结果、原始星盘和运限数据",
      
      // 时间戳（实际数据）
      timestamp: new Date().toISOString(),
      
      // 请求参数部分
      _requestDescription: "【请求参数】前端发送给后端的请求参数，包含出生日期、时辰、性别等信息",
      request: parsed.data,
      
      // 映射后的数据部分
      _mappedDataDescription: "【映射后的简化数据】经过 mapper.mapNatal() 处理后的结构化数据，用于前端展示。包含阳历/阴历日期、五行局、命主身主、十二宫位等简化后的信息",
      mappedData: data,
      
      // 原始星盘数据部分
      _rawAstrolabeDescription: "【原始星盘数据 (rawAstrolabe)】iztro 库生成的完整星盘对象（已序列化，去除了方法）。包含所有宫位的详细信息、星曜分布、四化等完整数据，用于 react-iztro 组件渲染",
      rawAstrolabe: rawAstrolabe,
      
      // 原始运限数据部分
      _rawHoroscopeDescription: "【原始运限数据 (rawHoroscope)】当前运限（大限/流年等）的完整数据（已序列化）。包含运限相关的所有信息，用于运限显示和切换",
      rawHoroscope: rawHoroscope,
      
      // 运限时间信息
      _horoscopeDateDescription: "【运限日期】运限对应的日期（ISO 格式字符串）",
      horoscopeDate: horoscopeDate.toISOString(),
      _horoscopeHourDescription: "【运限时辰】运限对应的时辰索引（0-12）",
      horoscopeHour: horoscopeHour,
    };
    
    // 异步写入文件，不阻塞响应
    writeJson(logFileName, fullResponse).catch((err) => {
      console.error("保存日志文件失败:", err);
    });

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H3",
        location: "src/app/api/ziwei/natal/route.ts:POST:payload",
        message: "natal response payload sizes",
        data: {
          astrolabeSize: JSON.stringify(rawAstrolabe).length,
          horoscopeSize: JSON.stringify(rawHoroscope).length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log

    return NextResponse.json(
      {
        ...data,
        rawAstrolabe,
        rawHoroscope,
        horoscopeDate: horoscopeDate.toISOString(),
        horoscopeHour,
      },
      {
        headers: {
          "X-RateLimit-Remaining": String(rate.remaining),
          "X-RateLimit-Reset": String(rate.resetAt),
        },
      }
    );
  } catch (err) {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H8",
        location: "src/app/api/ziwei/natal/route.ts:POST:error",
        message: "natal handler error",
        data: { message: err instanceof Error ? err.message : "unknown" },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log

    return NextResponse.json(
      { error: "排盘失败，请稍后重试。" },
      { status: 500 }
    );
  }
}

/**
 * 从请求头取真实 IP。
 * 这样做是为了在 Vercel / 反向代理环境下得到真实来源。
 */
function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "0.0.0.0";
}

