import { NextResponse } from "next/server";
import https from "node:https";
import { Readable } from "node:stream";
import { Agent, ProxyAgent } from "undici";

export const runtime = "nodejs";
// 长回答（尤其是 thinking 模式）可能超过 60s，这里放宽后端执行窗口，减少“说到一半断流”
export const maxDuration = 300;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ModelConfig = {
  id: string;
  label: string;
  apiKeyEnv: string;
  modelEnv: string;
  defaultModel?: string;
  baseUrlEnv: string;
  defaultBaseUrl: string;
  temperature?: number;
  // 不同厂商的扩展参数（例如 ByteDance ModelArk 的 thinking 开关）
  thinking?: {
    type: "enabled" | "disabled";
  };
};

type UndiciRequestInit = RequestInit & {
  // undici 扩展字段：用于自定义代理与连接参数
  dispatcher?: Agent | ProxyAgent;
};

type DispatcherCandidate = {
  mode: "direct" | "proxy";
  proxyUrl?: string;
  dispatcher: Agent | ProxyAgent;
};

type SocksCandidate = {
  mode: "socks";
  proxyUrl: string;
};

type TransportCandidate = DispatcherCandidate | SocksCandidate;

type UpstreamResponse = {
  ok: boolean;
  status: number;
  body: ReadableStream<Uint8Array> | null;
  failText?: string;
};

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  "kimi-thinking": {
    id: "kimi-thinking",
    label: "Kimi（Thinking）",
    apiKeyEnv: "KIMI_API_KEY",
    modelEnv: "KIMI_MODEL",
    // 按官方 k2.5 thinking 文档建议，要求用户显式配置模型名，避免误回退到 v1
    defaultModel: undefined,
    baseUrlEnv: "KIMI_BASE_URL",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    // Kimi k2.5 thinking 模型要求 temperature 固定为 1
    temperature: 1,
  },
  gemini3pro: {
    id: "gemini3pro",
    label: "Gemini 3 Pro",
    apiKeyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    // 默认切到 3.1 Pro 预览版，和当前官方文档保持一致，减少模型下线/不可用导致的 fetch failed
    defaultModel: "gemini-3.1-pro-preview",
    // 使用 Gemini OpenAI 兼容端点时可直接走 chat/completions
    baseUrlEnv: "GEMINI_BASE_URL",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  },
  gpt53: {
    id: "gpt53",
    label: "GPT 5.3",
    apiKeyEnv: "OPENAI_API_KEY",
    modelEnv: "OPENAI_MODEL_GPT53",
    defaultModel: "gpt-4.1",
    baseUrlEnv: "OPENAI_BASE_URL",
    defaultBaseUrl: "https://api.openai.com/v1",
    temperature: 0.7,
  },
  "seed-1-8-thinking": {
    id: "seed-1-8-thinking",
    label: "ByteDance Seed 1.8（Thinking）",
    apiKeyEnv: "ARK_API_KEY",
    modelEnv: "ARK_MODEL_SEED18",
    // Seed 1.8 的版本号更新较快，建议显式配置，避免默认值失效
    defaultModel: undefined,
    baseUrlEnv: "ARK_BASE_URL",
    defaultBaseUrl: "https://ark.ap-southeast.bytepluses.com/api/v3",
    // 按 ModelArk 文档支持 thinking 模式，这里默认开启
    thinking: { type: "enabled" },
  },
};

function sse(event: unknown) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function toTextDelta(delta: unknown) {
  if (!delta) return "";
  if (typeof delta === "string") return delta;
  if (Array.isArray(delta)) {
    return delta
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "未知错误";
  // Node 的 fetch 在网络层失败时常见为 "fetch failed"，更关键的信息通常挂在 cause 上
  const cause =
    typeof (error as { cause?: unknown }).cause === "object" &&
    (error as { cause?: unknown }).cause !== null
      ? String((error as { cause?: { message?: unknown } }).cause?.message || "")
      : "";
  return cause ? `${error.message} | cause: ${cause}` : error.message;
}

function getConnectTimeoutMs() {
  // 默认把连接超时从 undici 的 10s 放宽到 30s，弱网下更稳
  const connectTimeoutMs = Number(process.env.LLM_CONNECT_TIMEOUT_MS || 30000);
  return Number.isFinite(connectTimeoutMs) && connectTimeoutMs > 0
    ? connectTimeoutMs
    : 30000;
}

function getSocksRequestTimeoutMs() {
  // SOCKS 场景下，模型首包可能较慢（大上下文/高负载时常见），给更宽松的超时窗口
  const timeoutMs = Number(process.env.LLM_SOCKS_REQUEST_TIMEOUT_MS || 180000);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 180000;
}

function getTransportCandidates(config: ModelConfig): TransportCandidate[] {
  // 对 Gemini 这类海外 API，支持按模型单独配置代理，避免影响其他模型
  const proxyUrl =
    process.env[`${config.id.toUpperCase()}_PROXY_URL`]?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim();
  const timeout = getConnectTimeoutMs();
  const direct = {
    mode: "direct" as const,
    dispatcher: new Agent({ connect: { timeout } }),
  };

  if (proxyUrl) {
    // 支持 socks5://，因为不少 VPN 客户端只暴露 SOCKS 端口（例如 1080）
    if (proxyUrl.startsWith("socks5://") || proxyUrl.startsWith("socks://")) {
      return [
        {
          mode: "socks" as const,
          proxyUrl,
        },
        direct,
      ];
    }
    // http/https 代理保持原逻辑，优先走代理，失败自动回退直连
    if (proxyUrl.startsWith("http://") || proxyUrl.startsWith("https://")) {
      return [
        {
          mode: "proxy" as const,
          proxyUrl,
          dispatcher: new ProxyAgent({
            uri: proxyUrl,
            connect: { timeout },
          }),
        },
        direct,
      ];
    }
    // 未识别协议时保守回退直连，并在错误里提示用户改配置
    return [direct];
  }
  return [direct];
}

function readNodeStreamAsText(stream: NodeJS.ReadableStream) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    );
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    stream.on("error", reject);
  });
}

function createSocksProxyAgent(proxyUrl: string) {
  try {
    // 按需加载：避免未安装依赖时整个项目在编译阶段直接报错
    const mod = require("socks-proxy-agent") as {
      SocksProxyAgent: new (url: string) => https.Agent;
    };
    return new mod.SocksProxyAgent(proxyUrl);
  } catch {
    throw new Error(
      "检测到 socks 代理配置，但缺少依赖 socks-proxy-agent。请先执行 npm i socks-proxy-agent 后重启服务。"
    );
  }
}

function requestViaSocksProxy(params: {
  endpoint: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  thinking?: ModelConfig["thinking"];
  proxyUrl: string;
}) {
  const { endpoint, apiKey, model, messages, temperature, thinking, proxyUrl } =
    params;
  const timeout = getSocksRequestTimeoutMs();
  const payloadBody: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    temperature,
  };
  if (thinking) {
    payloadBody.thinking = thinking;
  }
  const payload = JSON.stringify(payloadBody);

  return new Promise<UpstreamResponse>((resolve, reject) => {
    const url = new URL(endpoint);
    const agent = createSocksProxyAgent(proxyUrl);
    const req = https.request(
      url,
      {
        method: "POST",
        agent,
        timeout,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      async (res) => {
        const status = res.statusCode || 500;
        const ok = status >= 200 && status < 300;
        if (!ok) {
          const failText = await readNodeStreamAsText(res).catch(() => "");
          resolve({ ok, status, body: null, failText });
          return;
        }
        const webBody = Readable.toWeb(res) as ReadableStream<Uint8Array>;
        resolve({ ok, status, body: webBody });
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error(`SOCKS 请求超时（${timeout}ms）`));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function requestUpstream(params: {
  endpoint: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  thinking?: ModelConfig["thinking"];
  candidate: TransportCandidate;
}) {
  const { endpoint, apiKey, model, messages, temperature, thinking, candidate } =
    params;
  if (candidate.mode === "socks") {
    return requestViaSocksProxy({
      endpoint,
      apiKey,
      model,
      messages,
      temperature,
      thinking,
      proxyUrl: candidate.proxyUrl,
    });
  }
  const payload: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    temperature,
  };
  if (thinking) {
    payload.thinking = thinking;
  }
  const requestInit: UndiciRequestInit = {
    // Node.js fetch(undici) 支持 dispatcher，可用于代理与连接参数控制
    dispatcher: candidate.dispatcher,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  };
  const upstream = await fetch(endpoint, requestInit);
  if (!upstream.ok || !upstream.body) {
    const failText = await upstream.text().catch(() => "");
    return {
      ok: false,
      status: upstream.status,
      body: null,
      failText,
    } satisfies UpstreamResponse;
  }
  return {
    ok: true,
    status: upstream.status,
    body: upstream.body,
  } satisfies UpstreamResponse;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = (body?.messages || []) as ChatMessage[];
    // 前端未传模型时，后端兜底走 Seed 1.8（Thinking）
    const modelId = String(body?.modelId || "seed-1-8-thinking");

    const config = MODEL_CONFIGS[modelId];
    if (!config) {
      return NextResponse.json(
        { error: `不支持的模型：${modelId}` },
        { status: 400 }
      );
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages 不能为空" }, { status: 400 });
    }

    const apiKey = process.env[config.apiKeyEnv]?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: `未配置 ${config.apiKeyEnv}，请先在环境变量中设置` },
        { status: 500 }
      );
    }

    const model = process.env[config.modelEnv]?.trim() || config.defaultModel;
    if (!model) {
      return NextResponse.json(
        {
          error: `未配置 ${config.modelEnv}，请在 .env.local 设置 ${config.label} 对应的模型名`,
        },
        { status: 500 }
      );
    }
    const baseUrl = process.env[config.baseUrlEnv]?.trim() || config.defaultBaseUrl;
    const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
    const temperature = config.temperature ?? 0.7;
    const transportCandidates = getTransportCandidates(config);

    let upstream: UpstreamResponse | null = null;
    let lastError: unknown = null;
    const attemptErrors: string[] = [];

    for (const candidate of transportCandidates) {
      try {
        upstream = await requestUpstream({
          endpoint,
          apiKey,
          model,
          messages,
          temperature,
          thinking: config.thinking,
          candidate,
        });
        if (upstream.ok && upstream.body) break;
        const modeText =
          candidate.mode === "proxy"
            ? `proxy(${candidate.proxyUrl})`
            : candidate.mode === "socks"
              ? `socks(${candidate.proxyUrl})`
              : "direct";
        attemptErrors.push(
          `${modeText}: upstream_status_${upstream.status} ${
            upstream.failText || "上游返回异常"
          }`
        );
      } catch (error) {
        lastError = error;
        const modeText =
          candidate.mode === "proxy"
            ? `proxy(${candidate.proxyUrl})`
            : candidate.mode === "socks"
              ? `socks(${candidate.proxyUrl})`
            : "direct";
        attemptErrors.push(`${modeText}: ${getErrorMessage(error)}`);
      }
    }

    if (!upstream || !upstream.ok || !upstream.body) {
      return NextResponse.json(
        {
          error: `${config.label} 网络请求失败`,
          detail: getErrorMessage(lastError),
          attempts: attemptErrors,
          endpoint,
          model,
          hint: "请检查 GEMINI_BASE_URL / 代理配置 / 防火墙。若你用的是 SOCKS 端口（如 1080），建议删掉 GEMINI3PRO_PROXY_URL 改走 VPN 全局，或改为 HTTP 代理端口。",
        },
        { status: 500 }
      );
    }

    const upstreamBody = upstream.body;
    if (!upstreamBody) {
      return NextResponse.json(
        { error: `${config.label} 响应为空，未收到可读数据流` },
        { status: 500 }
      );
    }

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstreamBody.getReader();
        let buffer = "";
        let doneSent = false;
        // 某些网络层会因“长时间无数据”断开连接，定时发心跳可显著降低该问题
        const heartbeat = setInterval(() => {
          if (doneSent) return;
          controller.enqueue(encoder.encode(sse({ type: "ping" })));
        }, 15000);
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";

            for (const eventBlock of events) {
              const lines = eventBlock
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean);
              for (const line of lines) {
                if (!line.startsWith("data:")) continue;
                const payload = line.slice(5).trim();
                if (!payload) continue;
                if (payload === "[DONE]") {
                  doneSent = true;
                  controller.enqueue(
                    encoder.encode(sse({ type: "done", reason: "done" }))
                  );
                  continue;
                }
                try {
                  const chunk = JSON.parse(payload);
                  const finishReason = chunk?.choices?.[0]?.finish_reason;
                  const delta = toTextDelta(chunk?.choices?.[0]?.delta?.content);
                  const reasoning = toTextDelta(
                    chunk?.choices?.[0]?.delta?.reasoning_content
                  );
                  if (reasoning) {
                    controller.enqueue(
                      encoder.encode(sse({ type: "reasoning", text: reasoning }))
                    );
                  }
                  if (delta) {
                    controller.enqueue(
                      encoder.encode(sse({ type: "delta", text: delta }))
                    );
                  }
                  if (finishReason) {
                    doneSent = true;
                    controller.enqueue(
                      encoder.encode(
                        sse({ type: "done", reason: String(finishReason) })
                      )
                    );
                  }
                } catch {
                  // 忽略非标准 chunk，避免中断整体流式输出
                }
              }
            }
          }
          // 若上游已结束但没发 [DONE]，也要给前端一个明确结束信号，方便判断“是否正常收尾”
          if (!doneSent) {
            controller.enqueue(
              encoder.encode(sse({ type: "done", reason: "upstream_closed" }))
            );
          }
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              sse({
                type: "error",
                error: error instanceof Error ? error.message : "流式输出中断",
              })
            )
          );
          controller.close();
        } finally {
          clearInterval(heartbeat);
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}


