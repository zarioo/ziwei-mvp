# ios-demo README

## 概述

`ios-demo` 是一个基于 Next.js App Router 实现的 iOS 风格命盘工作台页面，访问路径为 `/ios-demo`。

它不是原生 iOS 工程，而是一个面向移动端视觉和交互的 Web Demo，主要用于把以下能力串成一条完整流程：

- 输入出生信息并生成紫微斗数命盘
- 在页面内查看本命盘和运限切换结果
- 生成供大模型使用的命盘 JSON
- 基于命盘 JSON 进行流式 AI 问答
- 生成“人生剧本”式整体解读

## 页面结构

页面分为 3 个主标签：

- `Home`：录入出生信息、排盘、查看命盘摘要和命盘视图
- `Script`：生成人生剧本，并展示大限运势曲线
- `Chat`：挂载命盘 JSON 后进行多轮 AI 问答

底部有 tab 切换，聊天页带历史对话抽屉。

## 核心能力

### 1. 排盘

首页会收集以下字段：

- 姓名
- 性别
- 出生日期
- 出生时间
- 出生地点

点击“开始排盘”后，前端调用：

- `/api/ziwei/natal`：生成本命盘、命盘摘要、初始运限数据
- `/api/ziwei/horoscope`：在命盘视图中切换大限、流年、月、日、时后继续拉取运限

命盘渲染由 [`IztrolabeServer.tsx`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/src/components/IztrolabeServer.tsx) 负责，底层使用 `react-iztro`。

### 2. AI 问命

点击“AI问命”后，页面会先把当前命盘和运限信息整理成 LLM JSON，再通过 `/api/llm-json` 保存到本地：

- 输出目录：`data/json-to-llm/`
- 常见文件名：`{用户名}{日期}-chat.json`

随后页面进入聊天标签，自动挂载该 JSON，调用 `/api/ai/chat/stream` 进行流式回答。

当前支持的模型选项：

- ByteDance Seed 1.8
- Gemini 3 Pro
- GPT 5.3
- Kimi Thinking

说明：

- `GPT 5.3` 当前被标记为不支持文件直传，页面会自动把 JSON 文本拼接进 prompt
- 其余模型可直接走“附件 + 提问”的工作流

### 3. 人生剧本

点击“开启人生剧本”后，页面会：

1. 先基于当前命盘生成基础 LLM Payload
2. 再按大限逐段补齐对应时间切片
3. 将结果保存为本地 JSON
4. 调用当前选中的模型生成一份整体命运解读

Script 页同时会展示一组预设运势曲线：

- 总运
- 事业
- 财运
- 感情
- 健康

这些曲线目前是前端内置演示数据，用于表现视觉和交互，不是后端实时计算结果。

## 本地状态与持久化

页面会把以下内容写入浏览器 `localStorage`：

- 当前标签页
- 出生信息表单
- 当前命盘与运限数据
- 聊天记录和当前会话
- 选中的模型
- 最近一次生成的命盘 JSON
- 人生剧本文本和元数据

存储 key 为：`ziwei-ios-demo-v1`

这意味着刷新页面后，大部分工作现场会被恢复。

## 本地运行

在项目根目录执行：

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000/ios-demo
```

## 环境变量

`ios-demo` 依赖两类后端能力：

- 紫微排盘 API
- LLM 流式聊天 API

至少需要配置一个可用模型，否则聊天和人生剧本无法工作。

常用变量如下：

```bash
# 可选：Kimi
KIMI_API_KEY=
KIMI_MODEL=
KIMI_BASE_URL=https://api.moonshot.cn/v1

# 可选：Gemini
GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
GEMINI3PRO_PROXY_URL=

# 可选：OpenAI
OPENAI_API_KEY=
OPENAI_MODEL_GPT53=
OPENAI_BASE_URL=https://api.openai.com/v1

# 可选：ByteDance ModelArk
ARK_API_KEY=
ARK_MODEL_SEED18=
ARK_BASE_URL=https://ark.ap-southeast.bytepluses.com/api/v3

# 可选：接口限流 / 超时
ZIWEI_RATE_LIMIT_PER_MIN=30
LLM_CONNECT_TIMEOUT_MS=30000
LLM_SOCKS_REQUEST_TIMEOUT_MS=180000
```

如果本机访问 Gemini 需要代理，可以配置：

- `GEMINI3PRO_PROXY_URL=http://127.0.0.1:7890`
- 或 `GEMINI3PRO_PROXY_URL=socks5://127.0.0.1:1080`

## 相关文件

- 页面入口：[`page.tsx`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/src/app/ios-demo/page.tsx)
- 页面样式：[`page.module.css`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/src/app/ios-demo/page.module.css)
- 命盘组件：[`IztrolabeServer.tsx`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/src/components/IztrolabeServer.tsx)
- LLM Payload 生成：[`generateLLMPayload.ts`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/src/utils/generateLLMPayload.ts)
- AI 流式接口：[`route.ts`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/src/app/api/ai/chat/stream/route.ts)
- 命盘保存接口：[`route.ts`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/src/app/api/llm-json/route.ts)
- 本命盘接口：[`route.ts`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/src/app/api/ziwei/natal/route.ts)
- 运限接口：[`route.ts`](/Users/zoe/Desktop/桌面/ming/ziwei-mvp/src/app/api/ziwei/horoscope/route.ts)

## 当前约束

- 这是 Web Demo，不包含 Xcode、Swift、UIKit 或 SwiftUI 工程
- 出生地点字段当前只保留在前端状态中，尚未进入排盘请求
- 人生剧本中的运势图是静态展示数据，不代表真实推演结果
- 依赖外部模型服务时，响应速度和稳定性受网络、代理和供应商接口状态影响
