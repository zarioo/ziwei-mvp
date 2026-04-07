# 紫微斗数排盘 MVP（方案A）

本项目使用 Next.js App Router + API Route Handlers + iztro 排盘引擎。

## 本地运行

```bash
npm i
npm run dev
```

打开 [http://localhost:3000/pan](http://localhost:3000/pan) 进入排盘页面。

## 邮箱验证码登录配置

本项目使用 Resend 发送验证码邮件，请准备以下环境变量：

```
RESEND_API_KEY=你的Resend密钥
EMAIL_FROM=Ziwei <noreply@yourdomain.com>
```

说明：`EMAIL_FROM` 必须是 Resend 已验证的发件人域名或邮箱。

## AI问命功能环境变量

新增的 `/ai-chat` 页面默认使用 ByteDance Seed 1.8（Thinking）模型，支持流式输出和模型切换。

```bash
# 默认模型（Kimi）
KIMI_API_KEY=你的Kimi密钥
# 这里请填写 Kimi 官方文档中的 k2.5 thinking 具体模型名
KIMI_MODEL=请填kimi-k2.5-thinking模型名
KIMI_BASE_URL=https://api.moonshot.cn/v1

# 可选：Gemini（OpenAI兼容端点）
GEMINI_API_KEY=你的Gemini密钥
# 建议与当前项目默认值保持一致
GEMINI_MODEL=gemini-3.1-pro-preview
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
# 可选：如果本机无法直连 Google，请配置代理（示例为本机 Clash）
GEMINI3PRO_PROXY_URL=http://127.0.0.1:7890
# 也支持 SOCKS5（例如 TrojanX 常见的 1080 端口）
# GEMINI3PRO_PROXY_URL=socks5://127.0.0.1:1080
# 可选：放宽连接超时（毫秒），默认 30000
LLM_CONNECT_TIMEOUT_MS=30000
# 可选：SOCKS5 请求超时（毫秒），默认 180000（3分钟）
LLM_SOCKS_REQUEST_TIMEOUT_MS=180000

# 可选：OpenAI（用于 gpt53 档位）
OPENAI_API_KEY=你的OpenAI密钥
OPENAI_MODEL_GPT53=gpt-4.1
OPENAI_BASE_URL=https://api.openai.com/v1

# 可选：ByteDance ModelArk（用于 Seed 1.8 Thinking）
ARK_API_KEY=你的ModelArk密钥
# 请填写控制台里的 Seed 1.8 模型 ID（示例：seed-1-8-xxxxxx）
ARK_MODEL_SEED18=请填seed1.8模型ID
# ModelArk Chat API 基础地址
ARK_BASE_URL=https://ark.ap-southeast.bytepluses.com/api/v3
```

## 本地数据库说明

排盘记录与登录会话会保存到本地 SQLite 数据库：`data/ziwei.db`。
如果部署到无状态环境（如多实例或无持久磁盘），需要改用云数据库。

## 脚本工具

为了让 `node` 能直接执行 `.ts`，请先设置一次环境变量：

```bash
export NODE_OPTIONS="--import tsx"
```

然后执行：

```bash
node scripts/dumpIztro.ts
node scripts/dumpHoroscope.ts
node scripts/dumpApiOutput.ts
node scripts/contractDiff.ts
```

## curl 测试

```bash
curl -X POST http://localhost:3000/api/ziwei/natal \
  -H "Content-Type: application/json" \
  -d '{"calendar":"solar","date":"1984-7-24","timeIndex":6,"gender":"女","language":"zh-CN","fixLeap":true,"isLeapMonth":false}'
```

```bash
curl -X POST http://localhost:3000/api/ziwei/decadal \
  -H "Content-Type: application/json" \
  -d '{"calendar":"solar","date":"1984-7-24","timeIndex":6,"gender":"女","daxianIndex":3,"language":"zh-CN"}'
```

```bash
curl -X POST http://localhost:3000/api/ziwei/yearly \
  -H "Content-Type: application/json" \
  -d '{"calendar":"solar","date":"1984-7-24","timeIndex":6,"gender":"女","year":1984,"language":"zh-CN"}'
```

## Vercel 部署步骤

1. 在 Vercel 新建项目并导入当前仓库。
2. 确认框架为 Next.js，默认设置即可。
3. 配置环境变量：
   - `ZIWEI_RATE_LIMIT_PER_MIN`：每 IP 每分钟限流次数（默认 30）。
   - `RESEND_API_KEY`：Resend 邮件发送密钥。
   - `EMAIL_FROM`：Resend 已验证的发件人地址。
4. 部署后访问 `/pan` 页面。

## 约定说明

- 所有 API Route 强制 `runtime = "nodejs"` 并设置 `maxDuration = 10`。
- 本命盘结果已做 LRU 缓存（10 分钟），并包含基础限流。
- 字段结构对齐 `contracts/wendy_min_3items.json`，缺失字段先保留 key。
