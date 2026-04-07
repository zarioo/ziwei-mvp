"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import IztrolabeServer from "@/components/IztrolabeServer";
import { buildHoroscopeSlice, generateLLMPayload } from "@/utils/generateLLMPayload";
import styles from "./page.module.css";

type TabId = "home" | "script" | "chat";

type FormState = {
  name: string;
  gender: "男" | "女";
  birthday: string;
  birthTime: string;
  birthplace: string;
};

type PanelInput = {
  calendar: "solar" | "lunar";
  date: string;
  timeIndex: number;
  gender: "男" | "女";
  fixLeap?: boolean;
  isLeapMonth?: boolean;
  language?: string;
};

type NatalResult = {
  solarBirthDate: string | null;
  lunarBirthDate: string | null;
  wuxingju: string | null;
  mingzhu: string | null;
  shenzhu: string | null;
  palaces: Array<{
    displayName: string | null;
    dizhi: string | null;
    tianGan: string | null;
    majorStars: Array<{ name: string | null }>;
    minorStars: Array<{ name: string | null }>;
  }>;
};

type NatalApiResponse = NatalResult & {
  rawAstrolabe: unknown;
  rawHoroscope: unknown;
  horoscopeDate: string;
  horoscopeHour: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  displayContent: string;
  attachments?: Array<{ name: string }>;
  reasoning?: string;
  createdAt: number;
};

type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

type Attachment = {
  name: string;
  content: string;
};

type ModelOption = {
  id: "kimi-thinking" | "gemini3pro" | "gpt53" | "seed-1-8-thinking";
  label: string;
  supportsFileUpload: boolean;
};

type FortuneMetricId = "overall" | "career" | "wealth" | "love" | "health";

type FortunePoint = {
  age: number;
  value: number;
};

type FortuneMetric = {
  id: FortuneMetricId;
  label: string;
  color: string;
  buttonEndColor: string;
  softColor: string;
  glowColor: string;
  fillStart: string;
  fillEnd: string;
  points: FortunePoint[];
};

type ScriptMeta = {
  fileName: string;
  modelId: ModelOption["id"];
  prompt: string;
  generatedAt: number;
};

type PersistedState = {
  activeTab: TabId;
  form: FormState;
  panelInput: PanelInput | null;
  result: NatalResult | null;
  rawAstrolabe: unknown;
  rawHoroscope: unknown;
  horoscopeDateIso: string | null;
  horoscopeHour: number;
  chatInput: string;
  conversations: Conversation[];
  activeConversationId: string;
  chatModelId: ModelOption["id"];
  generatedJson: Attachment | null;
  lifeScriptText: string;
  lifeScriptMeta: ScriptMeta | null;
};

const STORAGE_KEY = "ziwei-ios-demo-v1";
const DEFAULT_FORM: FormState = {
  name: "",
  gender: "女",
  birthday: "1991-08-26",
  birthTime: "20:00",
  birthplace: "",
};

const DEFAULT_CHAT_PROMPT =
  "你是紫微斗数大师倪海厦，请你用毕生所学，为这位用户解析她的整体命运（json是她紫微斗数命盘及各个大限的数据），要求必须严谨，不要出现错误、实事求是、不要说客套话。";

const LIFE_SCRIPT_PROMPT = DEFAULT_CHAT_PROMPT;

const PRESET_QUESTIONS = [
  "我的感情关系里，最需要警惕的模式是什么？",
  "未来三年事业上最值得主动争取的方向是什么？",
  "这张命盘里最影响我人生走向的核心课题是什么？",
];

const MODELS: ModelOption[] = [
  { id: "seed-1-8-thinking", label: "ByteDance Seed 1.8", supportsFileUpload: true },
  { id: "gemini3pro", label: "Gemini 3 Pro", supportsFileUpload: true },
  { id: "gpt53", label: "GPT 5.3", supportsFileUpload: false },
  { id: "kimi-thinking", label: "Kimi Thinking", supportsFileUpload: true },
];

const FORTUNE_METRICS: FortuneMetric[] = [
  {
    id: "overall",
    label: "总运",
    color: "#4961ff",
    buttonEndColor: "#6b7cff",
    softColor: "rgba(73, 97, 255, 0.14)",
    glowColor: "rgba(73, 97, 255, 0.2)",
    fillStart: "rgba(130, 142, 255, 0.34)",
    fillEnd: "rgba(128, 222, 255, 0.12)",
    points: [
      { age: 4, value: 26 },
      { age: 14, value: 34 },
      { age: 24, value: 48 },
      { age: 34, value: 95 },
      { age: 44, value: 72 },
      { age: 54, value: 84 },
      { age: 64, value: 58 },
      { age: 74, value: 66 },
      { age: 84, value: 78 },
      { age: 94, value: 70 },
    ],
  },
  {
    id: "career",
    label: "事业",
    color: "#f28a2e",
    buttonEndColor: "#f6b253",
    softColor: "rgba(242, 138, 46, 0.14)",
    glowColor: "rgba(242, 138, 46, 0.2)",
    fillStart: "rgba(246, 166, 83, 0.32)",
    fillEnd: "rgba(255, 221, 164, 0.12)",
    points: [
      { age: 4, value: 22 },
      { age: 14, value: 30 },
      { age: 24, value: 54 },
      { age: 34, value: 62 },
      { age: 44, value: 56 },
      { age: 54, value: 82 },
      { age: 64, value: 76 },
      { age: 74, value: 88 },
      { age: 84, value: 80 },
      { age: 94, value: 68 },
    ],
  },
  {
    id: "wealth",
    label: "财运",
    color: "#2f8dff",
    buttonEndColor: "#57b0ff",
    softColor: "rgba(47, 141, 255, 0.14)",
    glowColor: "rgba(47, 141, 255, 0.18)",
    fillStart: "rgba(76, 156, 255, 0.32)",
    fillEnd: "rgba(124, 231, 255, 0.12)",
    points: [
      { age: 4, value: 18 },
      { age: 14, value: 26 },
      { age: 24, value: 36 },
      { age: 34, value: 52 },
      { age: 44, value: 80 },
      { age: 54, value: 74 },
      { age: 64, value: 88 },
      { age: 74, value: 76 },
      { age: 84, value: 90 },
      { age: 94, value: 82 },
    ],
  },
  {
    id: "love",
    label: "感情",
    color: "#ff6f97",
    buttonEndColor: "#ff8db1",
    softColor: "rgba(255, 111, 151, 0.14)",
    glowColor: "rgba(255, 111, 151, 0.18)",
    fillStart: "rgba(255, 143, 177, 0.3)",
    fillEnd: "rgba(255, 210, 221, 0.12)",
    points: [
      { age: 4, value: 28 },
      { age: 14, value: 40 },
      { age: 24, value: 64 },
      { age: 34, value: 30 },
      { age: 44, value: 70 },
      { age: 54, value: 78 },
      { age: 64, value: 50 },
      { age: 74, value: 62 },
      { age: 84, value: 72 },
      { age: 94, value: 60 },
    ],
  },
  {
    id: "health",
    label: "健康",
    color: "#25b27f",
    buttonEndColor: "#4cc996",
    softColor: "rgba(37, 178, 127, 0.14)",
    glowColor: "rgba(37, 178, 127, 0.18)",
    fillStart: "rgba(71, 204, 149, 0.28)",
    fillEnd: "rgba(176, 236, 209, 0.12)",
    points: [
      { age: 4, value: 58 },
      { age: 14, value: 66 },
      { age: 24, value: 72 },
      { age: 34, value: 64 },
      { age: 44, value: 78 },
      { age: 54, value: 68 },
      { age: 64, value: 60 },
      { age: 74, value: 64 },
      { age: 84, value: 56 },
      { age: 94, value: 48 },
    ],
  },
];

const TIME_INDEX_OPTIONS = [
  { value: 0, label: "早子时" },
  { value: 1, label: "丑时" },
  { value: 2, label: "寅时" },
  { value: 3, label: "卯时" },
  { value: 4, label: "辰时" },
  { value: 5, label: "巳时" },
  { value: 6, label: "午时" },
  { value: 7, label: "未时" },
  { value: 8, label: "申时" },
  { value: 9, label: "酉时" },
  { value: 10, label: "戌时" },
  { value: 11, label: "亥时" },
  { value: 12, label: "晚子时" },
] as const;

function renderTabIcon(tab: TabId) {
  if (tab === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 10.5L12 4l8 6.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M6.5 9.5V19h11V9.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (tab === "script") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 5.5h10.5A1.5 1.5 0 0 1 19 7v10.5a1 1 0 0 1-1.6.8L14 15.8H7A1.5 1.5 0 0 1 5.5 14.3V7A1.5 1.5 0 0 1 7 5.5Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M9 9.5h6M9 12.5h4.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6.5 8.5h11A1.5 1.5 0 0 1 19 10v6.5A1.5 1.5 0 0 1 17.5 18H11l-4.5 3v-3H6.5A1.5 1.5 0 0 1 5 16.5V10A1.5 1.5 0 0 1 6.5 8.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M8.5 12h7M8.5 15h5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function toTimeIndex(time: string): number {
  if (!time) return 0;
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;
  const total = hour * 60 + minute;
  if (total >= 23 * 60) return 12;
  if (total < 60) return 0;
  return Math.floor((total - 60) / 120) + 1;
}

function toApiDate(value: string) {
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${Number(y)}-${Number(m)}-${Number(d)}`;
}

function normalizeNameForFile(name: string) {
  const safe = name
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, "")
    .slice(0, 40);
  return safe || "user";
}

function formatTodayMMDD() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}

function buildDateForYear(birthday: string, year: number) {
  const [, monthText, dayText] = birthday.split("-");
  const month = Number(monthText);
  const day = Number(dayText);
  if (!month || !day) return new Date(year, 0, 1);
  const candidate = new Date(year, month - 1, day);
  if (candidate.getMonth() !== month - 1) {
    return new Date(year, month, 0);
  }
  return candidate;
}

function buildTextWithFiles(
  prompt: string,
  files: Attachment[],
  supportsFileUpload: boolean
) {
  if (files.length === 0) return prompt;
  const fileText = files
    .map((file) => `【文件：${file.name}】\n\`\`\`\n${file.content}\n\`\`\``)
    .join("\n\n");
  if (supportsFileUpload) {
    return `${prompt}\n\n以下是用户上传的文件内容：\n${fileText}`;
  }
  return `${prompt}\n\n当前模型不支持文件直传，已自动附加 JSON/文本内容：\n${fileText}`;
}

function createConversation(): Conversation {
  const now = Date.now();
  return {
    id: `conv-${now}`,
    title: "新对话",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function buildConversationTitle(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "新对话";
  return trimmed.slice(0, 18);
}

async function streamModelResponse(params: {
  modelId: ModelOption["id"];
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  onDelta: (text: string) => void;
  onReasoning?: (text: string) => void;
}) {
  const res = await fetch("/api/ai/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modelId: params.modelId,
      messages: params.messages,
    }),
  });

  if (!res.ok || !res.body) {
    const fail = await res.json().catch(() => ({}));
    throw new Error(fail?.error || "发送失败");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let gotDone = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        const event = JSON.parse(payload) as {
          type: "delta" | "reasoning" | "done" | "error" | "ping";
          text?: string;
          error?: string;
        };
        if (event.type === "error") {
          throw new Error(event.error || "流式输出失败");
        }
        if (event.type === "ping") continue;
        if (event.type === "done") {
          gotDone = true;
          continue;
        }
        if (event.type === "delta" && event.text) {
          params.onDelta(event.text);
        }
        if (event.type === "reasoning" && event.text && params.onReasoning) {
          params.onReasoning(event.text);
        }
      }
    }
  }

  if (!gotDone) {
    throw new Error("连接被提前关闭（未收到 done 事件）");
  }
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`strong-${idx}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`text-${idx}`}>{part}</span>;
  });
}

function renderSimpleMarkdown(content: string) {
  const lines = content.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    nodes.push(
      <ul key={`list-${nodes.length}`}>
        {listBuffer.map((item, idx) => (
          <li key={`li-${idx}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^\s*[-*]\s+/, ""));
      return;
    }

    flushList();
    if (!line.trim()) {
      nodes.push(<p key={`empty-${index}`}>&nbsp;</p>);
      return;
    }
    if (line.startsWith("### ")) {
      nodes.push(<h3 key={`h3-${index}`}>{renderInlineMarkdown(line.slice(4))}</h3>);
      return;
    }
    if (line.startsWith("#### ")) {
      nodes.push(<h4 key={`h4-${index}`}>{renderInlineMarkdown(line.slice(5))}</h4>);
      return;
    }
    if (line.startsWith("##### ")) {
      nodes.push(<h5 key={`h5-${index}`}>{renderInlineMarkdown(line.slice(6))}</h5>);
      return;
    }
    if (line.startsWith("###### ")) {
      nodes.push(<h6 key={`h6-${index}`}>{renderInlineMarkdown(line.slice(7))}</h6>);
      return;
    }
    if (line.startsWith("## ")) {
      nodes.push(<h2 key={`h2-${index}`}>{renderInlineMarkdown(line.slice(3))}</h2>);
      return;
    }
    if (line.startsWith("# ")) {
      nodes.push(<h1 key={`h1-${index}`}>{renderInlineMarkdown(line.slice(2))}</h1>);
      return;
    }
    nodes.push(<p key={`p-${index}`}>{renderInlineMarkdown(line)}</p>);
  });

  flushList();
  return nodes;
}

function renderFortuneMetricIcon(metricId: FortuneMetricId) {
  if (metricId === "overall") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M5 16.5 9.2 12l3.3 2.7 6-7.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.5 5.5v13h15"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (metricId === "career") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M8 8.5V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M5.5 9h13a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-6A1.5 1.5 0 0 1 5.5 9Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M10.5 12h3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (metricId === "wealth") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 5.5c-2.7 0-5 1.8-5 4s2.3 4 5 4 5 1.8 5 4-2.3 4-5 4-5-1.8-5-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 3.5v17"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (metricId === "love") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 19.5s-6.5-4.1-8.2-7.7c-1.1-2.3-.1-5 2.3-6.1 1.9-.9 4.1-.3 5.4 1.3 1.3-1.6 3.5-2.2 5.4-1.3 2.4 1.1 3.4 3.8 2.3 6.1C18.5 15.4 12 19.5 12 19.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20s7-3.6 7-9.5A4.5 4.5 0 0 0 14.5 6C13 6 12 7 12 7s-1-1-2.5-1A4.5 4.5 0 0 0 5 10.5C5 16.4 12 20 12 20Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12h2l1-2 1.2 4 1.3-2H17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buildFortuneChart(points: FortunePoint[]) {
  const width = Math.max(360, points.length * 44);
  const height = 272;
  const paddingX = 22;
  const paddingTop = 18;
  const paddingBottom = 34;
  const minAge = points[0]?.age ?? 0;
  const maxAge = points[points.length - 1]?.age ?? 100;
  const bottomY = height - paddingBottom;
  const chartHeight = bottomY - paddingTop;
  const chartWidth = width - paddingX * 2;
  const ageRange = Math.max(maxAge - minAge, 1);

  const coords = points.map((point) => ({
    ...point,
    x: paddingX + ((point.age - minAge) / ageRange) * chartWidth,
    y: paddingTop + ((100 - point.value) / 100) * chartHeight,
  }));

  const linePath = coords.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }
    const prev = coords[index - 1];
    const midX = (prev.x + point.x) / 2;
    return `${path} C ${midX} ${prev.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
  }, "");

  const areaPath = `${linePath} L ${coords[coords.length - 1]?.x ?? paddingX} ${bottomY} L ${
    coords[0]?.x ?? paddingX
  } ${bottomY} Z`;

  return {
    width,
    height,
    bottomY,
    labelY: bottomY + 18,
    coords,
    linePath,
    areaPath,
  };
}

export default function IosDemoPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const horoscopeInFlightRef = useRef<Promise<unknown> | null>(null);
  const horoscopePendingRef = useRef<{ date: Date; hour: number } | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [panelInput, setPanelInput] = useState<PanelInput | null>(null);
  const [result, setResult] = useState<NatalResult | null>(null);
  const [rawAstrolabe, setRawAstrolabe] = useState<unknown>(null);
  const [rawHoroscope, setRawHoroscope] = useState<unknown>(null);
  const [horoscopeDate, setHoroscopeDate] = useState<Date | null>(null);
  const [horoscopeHour, setHoroscopeHour] = useState(0);
  const [loading, setLoading] = useState(false);
  const [horoscopeLoading, setHoroscopeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [homeMessage, setHomeMessage] = useState<string | null>(null);
  const [generatedJson, setGeneratedJson] = useState<Attachment | null>(null);
  const [lifeScriptText, setLifeScriptText] = useState("");
  const [lifeScriptMeta, setLifeScriptMeta] = useState<ScriptMeta | null>(null);
  const [lifeScriptLoading, setLifeScriptLoading] = useState(false);
  const [lifeScriptError, setLifeScriptError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [chatInput, setChatInput] = useState(DEFAULT_CHAT_PROMPT);
  const [chatModelId, setChatModelId] =
    useState<ModelOption["id"]>("seed-1-8-thinking");
  const [activeFortuneMetricId, setActiveFortuneMetricId] =
    useState<FortuneMetricId>("overall");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const timeIndex = useMemo(() => toTimeIndex(form.birthTime), [form.birthTime]);
  const timeLabel =
    TIME_INDEX_OPTIONS.find((item) => item.value === timeIndex)?.label || "";
  const birthYear = useMemo(() => {
    const year = Number(form.birthday.split("-")[0]);
    return Number.isNaN(year) ? null : year;
  }, [form.birthday]);
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );
  const activeFortuneMetric = useMemo(
    () =>
      FORTUNE_METRICS.find((metric) => metric.id === activeFortuneMetricId) || FORTUNE_METRICS[0],
    [activeFortuneMetricId]
  );
  const activeFortuneChart = useMemo(
    () => buildFortuneChart(activeFortuneMetric.points),
    [activeFortuneMetric]
  );
  const fortuneTheme = useMemo(
    () =>
      ({
        "--fortune-accent": activeFortuneMetric.color,
        "--fortune-accent-soft": activeFortuneMetric.softColor,
        "--fortune-accent-glow": activeFortuneMetric.glowColor,
      }) as CSSProperties,
    [activeFortuneMetric]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as PersistedState;
      setActiveTab(saved.activeTab || "home");
      setForm(saved.form || DEFAULT_FORM);
      setPanelInput(saved.panelInput || null);
      setResult(saved.result || null);
      setRawAstrolabe(saved.rawAstrolabe || null);
      setRawHoroscope(saved.rawHoroscope || null);
      setHoroscopeDate(saved.horoscopeDateIso ? new Date(saved.horoscopeDateIso) : null);
      setHoroscopeHour(typeof saved.horoscopeHour === "number" ? saved.horoscopeHour : 0);
      setChatInput(saved.chatInput || DEFAULT_CHAT_PROMPT);
      setConversations(Array.isArray(saved.conversations) ? saved.conversations : []);
      setActiveConversationId(saved.activeConversationId || "");
      setChatModelId(saved.chatModelId || "seed-1-8-thinking");
      setGeneratedJson(saved.generatedJson || null);
      setLifeScriptText(saved.lifeScriptText || "");
      setLifeScriptMeta(saved.lifeScriptMeta || null);
    } catch {
      // ignore restore failure
    }
  }, []);

  useEffect(() => {
    if (conversations.length > 0) return;
    const next = createConversation();
    setConversations([next]);
    setActiveConversationId(next.id);
  }, [conversations.length]);

  useEffect(() => {
    const snapshot: PersistedState = {
      activeTab,
      form,
      panelInput,
      result,
      rawAstrolabe,
      rawHoroscope,
      horoscopeDateIso: horoscopeDate ? horoscopeDate.toISOString() : null,
      horoscopeHour,
      chatInput,
      conversations,
      activeConversationId,
      chatModelId,
      generatedJson,
      lifeScriptText,
      lifeScriptMeta,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // ignore write failure
    }
  }, [
    activeTab,
    form,
    panelInput,
    result,
    rawAstrolabe,
    rawHoroscope,
    horoscopeDate,
    horoscopeHour,
    chatInput,
    conversations,
    activeConversationId,
    chatModelId,
    generatedJson,
    lifeScriptText,
    lifeScriptMeta,
  ]);

  function startNewConversation(nextInput: string) {
    const nextConversation = createConversation();
    setConversations((prev) => [nextConversation, ...prev]);
    setActiveConversationId(nextConversation.id);
    setChatInput(nextInput);
    setAttachments([]);
    setChatError(null);
    setHistoryOpen(false);
    setActiveTab("chat");
  }

  function updateActiveConversation(
    updater: (conversation: Conversation) => Conversation
  ) {
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === activeConversationId ? updater(conversation) : conversation
      )
    );
  }

  async function loadFromApi(input: PanelInput) {
    const res = await fetch("/api/ziwei/natal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as NatalApiResponse | { error?: string };
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || "排盘失败");
    }
    const next = data as NatalApiResponse;
    setPanelInput(input);
    setResult(next);
    setRawAstrolabe(next.rawAstrolabe);
    setRawHoroscope(next.rawHoroscope);
    setHoroscopeDate(new Date(next.horoscopeDate));
    setHoroscopeHour(next.horoscopeHour);
  }

  async function runFetchHoroscope(date: Date, hour: number) {
    if (!panelInput) return null;
    const res = await fetch("/api/ziwei/horoscope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...panelInput,
        targetDate: date.toISOString(),
        targetHour: hour,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "运限计算失败");
    }
    setRawHoroscope(data.rawHoroscope);
    setHoroscopeDate(date);
    setHoroscopeHour(hour);
    return data.rawHoroscope;
  }

  async function fetchHoroscope(date: Date, hour: number) {
    if (!panelInput) return null;
    if (horoscopeInFlightRef.current) {
      horoscopePendingRef.current = { date, hour };
      return horoscopeInFlightRef.current;
    }
    setHoroscopeLoading(true);
    setError(null);
    const task = (async () => {
      try {
        return await runFetchHoroscope(date, hour);
      } finally {
        setHoroscopeLoading(false);
        horoscopeInFlightRef.current = null;
        if (horoscopePendingRef.current) {
          const next = horoscopePendingRef.current;
          horoscopePendingRef.current = null;
          void fetchHoroscope(next.date, next.hour);
        }
      }
    })();
    horoscopeInFlightRef.current = task;
    return task;
  }

  async function fetchHoroscopeRaw(date: Date) {
    if (!panelInput) return null;
    const res = await fetch("/api/ziwei/horoscope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...panelInput,
        targetDate: date.toISOString(),
        targetHour: horoscopeHour,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "运限计算失败");
    }
    return data.rawHoroscope;
  }

  async function persistPayload(
    payload: Record<string, unknown>,
    fileBaseName: string
  ) {
    const res = await fetch("/api/llm-json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        fileBaseName,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "保存 JSON 失败");
    }
    const fileName = data.fileName as string;
    return {
      fileName,
      attachment: {
        name: fileName,
        content: JSON.stringify(payload, null, 2),
      } satisfies Attachment,
    };
  }

  async function buildLifeScriptPayload() {
    if (!rawAstrolabe || !rawHoroscope || !birthYear) {
      throw new Error("请先完成排盘");
    }
    const basePayload = generateLLMPayload(rawAstrolabe, rawHoroscope, form, {
      includeCurrentTimeSlice: false,
    });
    const astrolabeWithPalaces = rawAstrolabe as {
      palaces?: Array<{
        decadal?: {
          range?: number[];
          heavenlyStem?: string;
          earthlyBranch?: string;
        };
      }>;
    };
    const palaces = astrolabeWithPalaces.palaces || [];
    const decades: Array<Record<string, unknown>> = [];

    for (const palace of palaces) {
      const range = palace?.decadal?.range || [];
      if (!Array.isArray(range) || range.length < 2) continue;
      const [startAge, endAge] = range;
      const targetYear = birthYear + startAge;
      const horoscope = await fetchHoroscopeRaw(buildDateForYear(form.birthday, targetYear));
      if (!horoscope) continue;
      decades.push({
        label: `${startAge}~${endAge} ${palace?.decadal?.heavenlyStem || ""}${palace?.decadal?.earthlyBranch || ""}`.trim(),
        start_age: startAge,
        end_age: endAge,
        target_year: targetYear,
        slice: buildHoroscopeSlice(rawAstrolabe, horoscope, {
          includeDecade: true,
          includeYear: false,
          includeMonth: false,
          includeDay: false,
        }),
      });
    }

    return {
      ...basePayload,
      selected_time_slices: {
        decades,
        years: [],
        months: [],
        days: [],
      },
    };
  }

  async function onSubmit() {
    setLoading(true);
    setError(null);
    setHomeMessage(null);
    try {
      if (!form.birthday || !form.birthTime) {
        throw new Error("请填写出生日期与出生时辰");
      }
      const payload: PanelInput = {
        calendar: "solar",
        date: toApiDate(form.birthday),
        timeIndex,
        gender: form.gender,
        fixLeap: true,
        isLeapMonth: false,
        language: "zh-CN",
      };
      await loadFromApi(payload);
      setHomeMessage("排盘完成，可继续 AI 问命或开启人生剧本");
    } catch (err) {
      setError(err instanceof Error ? err.message : "排盘失败");
    } finally {
      setLoading(false);
    }
  }

  async function onOpenChat() {
    setHomeMessage(null);
    setError(null);
    try {
      if (!rawAstrolabe || !rawHoroscope) {
        throw new Error("请先完成排盘");
      }
      const payload = generateLLMPayload(rawAstrolabe, rawHoroscope, form, {
        includeCurrentTimeSlice: true,
      });
      const fileBaseName = `${normalizeNameForFile(form.name || "user")}${formatTodayMMDD()}-chat`;
      const saved = await persistPayload(payload, fileBaseName);
      setGeneratedJson(saved.attachment);
      startNewConversation(DEFAULT_CHAT_PROMPT);
      setHomeMessage(`已生成问命 JSON：${saved.fileName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成问命 JSON 失败");
    }
  }

  async function onGenerateLifeScript() {
    setLifeScriptLoading(true);
    setLifeScriptError(null);
    setHomeMessage(null);
    try {
      const payload = await buildLifeScriptPayload();
      const fileBaseName = `${normalizeNameForFile(form.name || "user")}${formatTodayMMDD()}-script`;
      const saved = await persistPayload(payload, fileBaseName);
      const selectedModel = MODELS.find((item) => item.id === chatModelId) || MODELS[0];
      const mergedPrompt = buildTextWithFiles(
        LIFE_SCRIPT_PROMPT,
        [saved.attachment],
        selectedModel.supportsFileUpload
      );

      setGeneratedJson(saved.attachment);
      setLifeScriptText("");
      setLifeScriptMeta({
        fileName: saved.fileName,
        modelId: selectedModel.id,
        prompt: LIFE_SCRIPT_PROMPT,
        generatedAt: Date.now(),
      });
      setActiveTab("script");

      await streamModelResponse({
        modelId: selectedModel.id,
        messages: [
          {
            role: "system",
            content: "你是严谨的紫微斗数分析助手。只能基于用户给出的命盘 JSON 做推理，不编造事实。",
          },
          {
            role: "user",
            content: mergedPrompt,
          },
        ],
        onDelta: (text) => setLifeScriptText((prev) => prev + text),
      });
    } catch (err) {
      setLifeScriptError(err instanceof Error ? err.message : "人生剧本生成失败");
    } finally {
      setLifeScriptLoading(false);
    }
  }

  async function onSelectFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      next.push({ name: file.name, content: text });
    }
    setAttachments((prev) => [...prev, ...next]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeAttachment(name: string) {
    setAttachments((prev) => prev.filter((item) => item.name !== name));
  }

  async function onSendChat() {
    if (chatLoading || !activeConversation) return;
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    setChatError(null);
    const selectedModel = MODELS.find((item) => item.id === chatModelId) || MODELS[0];
    const files = [...attachments, ...(generatedJson ? [generatedJson] : [])];
    const mergedPrompt = buildTextWithFiles(trimmed, files, selectedModel.supportsFileUpload);

    const now = Date.now();
    const userMessage: ChatMessage = {
      id: `user-${now}`,
      role: "user",
      content: mergedPrompt,
      displayContent: trimmed,
      attachments: files.map((file) => ({ name: file.name })),
      createdAt: now,
    };
    const assistantMessage: ChatMessage = {
      id: `assistant-${now + 1}`,
      role: "assistant",
      content: "",
      displayContent: "",
      reasoning: "",
      createdAt: now + 1,
    };

    const conversationMessages = activeConversation.messages;
    updateActiveConversation((conversation) => ({
      ...conversation,
      updatedAt: now,
      title: buildConversationTitle(trimmed),
      messages: [...conversation.messages, userMessage, assistantMessage],
    }));
    setChatLoading(true);
    setChatInput("");
    setAttachments([]);
    setGeneratedJson(null);

    try {
      await streamModelResponse({
        modelId: selectedModel.id,
        messages: [
          {
            role: "system",
            content: "你是严谨的紫微斗数分析助手。需要基于用户提供的命盘 JSON 进行实证推理，不编造事实。",
          },
          ...conversationMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          {
            role: "user",
            content: mergedPrompt,
          },
        ],
        onDelta: (text) =>
          updateActiveConversation((conversation) => ({
            ...conversation,
            updatedAt: Date.now(),
            messages: conversation.messages.map((item) =>
              item.id === assistantMessage.id
                ? {
                    ...item,
                    content: `${item.content}${text}`,
                    displayContent: `${item.displayContent}${text}`,
                  }
                : item
            ),
          })),
        onReasoning: (text) =>
          updateActiveConversation((conversation) => ({
            ...conversation,
            updatedAt: Date.now(),
            messages: conversation.messages.map((item) =>
              item.id === assistantMessage.id
                ? { ...item, reasoning: `${item.reasoning || ""}${text}` }
                : item
            ),
          })),
      });
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setChatLoading(false);
    }
  }

  function jumpToPresetQuestion(question: string) {
    startNewConversation(question);
  }

  return (
    <main className={styles.page}>
      <section className={styles.appShell}>
        <header className={styles.topBar}>
          <div className={styles.topBarLead}>
            {activeTab === "chat" ? (
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setHistoryOpen(true)}
                aria-label="打开历史对话"
              >
                ≡
              </button>
            ) : null}
            <div>
              <p className={styles.eyebrow}>命盘工作台</p>
              <h1>天机 ZEN</h1>
            </div>
          </div>
          <div className={styles.topMeta}>
            <span>{form.name || "未命名命盘"}</span>
            <span>{timeLabel || "时辰待定"}</span>
          </div>
        </header>

        {historyOpen ? (
          <div className={styles.historyOverlay} onClick={() => setHistoryOpen(false)}>
            <aside
              className={styles.historyDrawer}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.historyHeader}>
                <h3>历史对话</h3>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => setHistoryOpen(false)}
                  aria-label="关闭历史对话"
                >
                  ×
                </button>
              </div>
              <button
                type="button"
                className={styles.newConversationButton}
                onClick={() => startNewConversation(DEFAULT_CHAT_PROMPT)}
              >
                + 新对话
              </button>
              <div className={styles.historyList}>
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    className={`${styles.historyItem} ${
                      conversation.id === activeConversationId ? styles.historyItemActive : ""
                    }`}
                    onClick={() => {
                      setActiveConversationId(conversation.id);
                      setHistoryOpen(false);
                      setActiveTab("chat");
                    }}
                  >
                    <span>{conversation.title}</span>
                    <small>{new Date(conversation.updatedAt).toLocaleString("zh-CN")}</small>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        ) : null}

        <div
          className={`${styles.content} ${
            activeTab === "script"
              ? styles.contentWithQuestionDock
              : activeTab === "chat"
                ? styles.contentWithComposer
                : ""
          }`}
        >
          {activeTab === "home" ? (
            <div className={styles.tabPane}>
              <section className={styles.card}>
                <div className={styles.sectionHeader}>
                  <h3>出生信息</h3>
                  <span>{timeLabel}</span>
                </div>
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>姓名</span>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="可不填"
                    />
                  </label>
                  <label className={styles.field}>
                    <span>性别</span>
                    <select
                      value={form.gender}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          gender: e.target.value as FormState["gender"],
                        }))
                      }
                    >
                      <option value="女">女</option>
                      <option value="男">男</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>出生日期</span>
                    <input
                      type="date"
                      value={form.birthday}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, birthday: e.target.value }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>出生时间</span>
                    <input
                      type="time"
                      step={60}
                      value={form.birthTime}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, birthTime: e.target.value }))
                      }
                    />
                  </label>
                  <label className={`${styles.field} ${styles.fieldWide}`}>
                    <span>出生地点</span>
                    <input
                      value={form.birthplace}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, birthplace: e.target.value }))
                      }
                      placeholder="城市或具体地点"
                    />
                  </label>
                </div>
                <div className={styles.homeActionGrid}>
                  <button className={styles.homeActionButton} onClick={onSubmit} type="button">
                    {loading ? "排盘中..." : "开始排盘"}
                  </button>
                  <button className={styles.homeActionButton} onClick={onOpenChat} type="button">
                    AI问命
                  </button>
                  <button
                    className={styles.homeActionButton}
                    onClick={onGenerateLifeScript}
                    type="button"
                  >
                    {lifeScriptLoading ? "生成中..." : "开启人生剧本"}
                  </button>
                </div>
                {error ? <p className={styles.errorText}>{error}</p> : null}
                {homeMessage ? <p className={styles.successText}>{homeMessage}</p> : null}
              </section>

              {result ? (
                <section className={styles.card}>
                  <div className={styles.sectionHeader}>
                    <h3>命盘摘要</h3>
                    <span>{horoscopeLoading ? "运势切换中..." : "已同步"}</span>
                  </div>
                  <div className={styles.summaryGrid}>
                    <div>
                      <span>阳历</span>
                      <strong>{result.solarBirthDate || "—"}</strong>
                    </div>
                    <div>
                      <span>阴历</span>
                      <strong>{result.lunarBirthDate || "—"}</strong>
                    </div>
                    <div>
                      <span>五行局</span>
                      <strong>{result.wuxingju || "—"}</strong>
                    </div>
                    <div>
                      <span>命主 / 身主</span>
                      <strong>{`${result.mingzhu || "—"} / ${result.shenzhu || "—"}`}</strong>
                    </div>
                  </div>
                </section>
              ) : null}

              <section className={styles.card}>
                <div className={styles.sectionHeader}>
                  <h3>命盘视图</h3>
                  <span>
                    {horoscopeDate
                      ? horoscopeDate.toLocaleDateString("zh-CN")
                      : "等待排盘"}
                  </span>
                </div>
                {rawAstrolabe && rawHoroscope && horoscopeDate ? (
                  <div className={styles.chartWrap}>
                    <IztrolabeServer
                      astrolabe={rawAstrolabe}
                      horoscope={rawHoroscope}
                      horoscopeDate={horoscopeDate}
                      horoscopeHour={horoscopeHour}
                      centerPalaceAlign
                      onHoroscopeChange={fetchHoroscope}
                    />
                  </div>
                ) : (
                  <div className={styles.emptyCard}>
                    输入出生信息后，这里展示移动端适配后的命盘。
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {activeTab === "script" ? (
            <div className={styles.tabPane}>
              <section className={styles.heroCard}>
                <div>
                  <h2>{`${form.name || "这位用户"}的人生剧本`}</h2>
                </div>
                {lifeScriptMeta ? (
                  <div className={styles.metaBadge}>JSON: {lifeScriptMeta.fileName}</div>
                ) : null}
              </section>

              <section className={styles.fortuneCard} style={fortuneTheme}>
                <div className={styles.fortuneHeader}>
                  <div className={styles.fortuneBadge}>{renderFortuneMetricIcon("overall")}</div>
                  <div className={styles.fortuneHeaderText}>
                    <h3>大限排行</h3>
                    <p>每十年一变的核心运势大阶段</p>
                  </div>
                </div>

                <div className={styles.fortuneChartShell}>
                  <div className={styles.fortuneChartViewport}>
                    <div className={styles.fortuneScrollArea}>
                      <div
                        className={styles.fortuneScrollContent}
                        style={{ width: `${activeFortuneChart.width}px` }}
                      >
                        <div className={styles.fortuneChartFrame}>
                          <svg
                            className={styles.fortuneChart}
                            viewBox={`0 0 ${activeFortuneChart.width} ${activeFortuneChart.height}`}
                            preserveAspectRatio="none"
                            role="img"
                            aria-label={`${activeFortuneMetric.label}运势曲线图`}
                          >
                            <defs>
                              <linearGradient id="fortune-surface-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor={activeFortuneMetric.fillStart} />
                                <stop offset="100%" stopColor={activeFortuneMetric.fillEnd} />
                              </linearGradient>
                              <linearGradient id="fortune-area-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor={activeFortuneMetric.fillStart} />
                                <stop offset="100%" stopColor={activeFortuneMetric.fillEnd} />
                              </linearGradient>
                              <linearGradient id="fortune-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor={activeFortuneMetric.color} />
                                <stop offset="100%" stopColor={activeFortuneMetric.buttonEndColor} />
                              </linearGradient>
                            </defs>

                            <rect
                              x={0}
                              y={0}
                              width={activeFortuneChart.width}
                              height={activeFortuneChart.height}
                              fill="url(#fortune-surface-gradient)"
                              opacity="0.72"
                            />

                            {activeFortuneChart.coords.map((point, index) => (
                              <line
                                key={`fortune-grid-${point.age}`}
                                x1={point.x}
                                y1={0}
                                x2={point.x}
                                y2={activeFortuneChart.bottomY}
                                className={
                                  index === 0 ? styles.fortuneGridLineMuted : styles.fortuneGridLine
                                }
                              />
                            ))}

                            <path d={activeFortuneChart.areaPath} fill="url(#fortune-area-gradient)" />
                            <path
                              d={activeFortuneChart.linePath}
                              className={styles.fortuneLineShadow}
                              stroke={activeFortuneMetric.color}
                            />
                            <path d={activeFortuneChart.linePath} className={styles.fortuneLine} />

                            {activeFortuneMetric.points.map((point) => {
                              const target = activeFortuneChart.coords.find(
                                (item) => item.age === point.age
                              );
                              if (!target) return null;
                              return (
                                <text
                                  key={`fortune-age-${point.age}`}
                                  x={target.x}
                                  y={activeFortuneChart.labelY}
                                  textAnchor="middle"
                                  className={styles.fortuneAgeText}
                                >
                                  {point.age}
                                </text>
                              );
                            })}
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.fortuneMetricRow}>
                  {FORTUNE_METRICS.map((metric) => {
                    const isActive = metric.id === activeFortuneMetricId;
                    return (
                      <button
                        key={metric.id}
                        type="button"
                        className={`${styles.fortuneMetricButton} ${
                          isActive ? styles.fortuneMetricButtonActive : ""
                        }`}
                        style={
                          isActive
                            ? ({
                                "--fortune-button-accent": metric.color,
                                "--fortune-button-accent-end": metric.buttonEndColor,
                              } as CSSProperties)
                            : undefined
                        }
                        onClick={() => setActiveFortuneMetricId(metric.id)}
                      >
                        <span className={styles.fortuneMetricIcon}>
                          {renderFortuneMetricIcon(metric.id)}
                        </span>
                        <span className={styles.fortuneMetricLabel}>{metric.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={styles.card}>
                {!lifeScriptLoading && lifeScriptText ? (
                  <div className={styles.scriptReady}>已生成</div>
                ) : null}
                {lifeScriptError ? <p className={styles.errorText}>{lifeScriptError}</p> : null}
                {lifeScriptText ? (
                  <div className={styles.markdownBody}>{renderSimpleMarkdown(lifeScriptText)}</div>
                ) : (
                  <div className={styles.emptyCard}>
                    {lifeScriptLoading ? "正在生成整体命运解读..." : "还没有人生剧本内容。"}
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {activeTab === "chat" ? (
            <div className={styles.chatPane}>
              <section className={styles.heroCard}>
                <div className={styles.chatHeaderTitle}>问命</div>
                <label className={styles.modelPicker}>
                  <span>模型</span>
                  <select
                    value={chatModelId}
                    onChange={(e) => setChatModelId(e.target.value as ModelOption["id"])}
                  >
                    {MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              <section className={styles.chatMessages}>
                {(activeConversation?.messages || []).length === 0 ? (
                  <div className={styles.emptyCard}>
                    {generatedJson
                      ? "命盘 JSON 已挂载，可直接发送问题。"
                      : "从首页或人生剧本页进入后，在这里继续问命。"}
                  </div>
                ) : (
                  activeConversation?.messages.map((message) => (
                    <article
                      key={message.id}
                      className={`${styles.chatBubble} ${
                        message.role === "assistant" ? styles.assistantBubble : styles.userBubble
                      }`}
                    >
                      <span className={styles.chatRole}>
                        {message.role === "assistant" ? "天机ZEN" : "你"}
                      </span>
                      {message.reasoning ? (
                        <pre className={styles.reasoning}>{message.reasoning}</pre>
                      ) : null}
                      {message.role === "assistant" ? (
                        <div className={styles.markdownBody}>
                          {renderSimpleMarkdown(message.displayContent)}
                        </div>
                      ) : (
                        <div className={styles.userMessageBody}>
                          <pre className={styles.userText}>{message.displayContent}</pre>
                          {message.attachments?.length ? (
                            <div className={styles.attachmentStrip}>
                              {message.attachments.map((file) => (
                                <span key={file.name} className={styles.attachmentTag}>
                                  {file.name}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </article>
                  ))
                )}
              </section>
            </div>
          ) : null}
        </div>

        {activeTab === "script" && !lifeScriptLoading && lifeScriptText.trim() ? (
          <div className={styles.floatingQuestionDock}>
            {PRESET_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                className={styles.questionButton}
                onClick={() => jumpToPresetQuestion(question)}
              >
                {question}
              </button>
            ))}
          </div>
        ) : null}

        {activeTab === "chat" ? (
          <section className={styles.composer}>
            {generatedJson ? (
              <div className={styles.attachmentStrip}>
                <span className={styles.attachmentTag}>命盘 JSON · {generatedJson.name}</span>
              </div>
            ) : null}
            {attachments.length > 0 ? (
              <div className={styles.attachmentStrip}>
                {attachments.map((file) => (
                  <button
                    key={file.name}
                    type="button"
                    className={styles.attachmentTag}
                    onClick={() => removeAttachment(file.name)}
                  >
                    {file.name} ×
                  </button>
                ))}
              </div>
            ) : null}
            <div className={styles.inputShell}>
              <textarea
                rows={2}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="给命盘继续提问..."
              />
              <div className={styles.composerActions}>
                <label className={styles.uploadButton}>
                  +
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={(e) => onSelectFiles(e.target.files)}
                  />
                </label>
                <button
                  className={styles.sendButton}
                  type="button"
                  onClick={onSendChat}
                  aria-label="发送"
                >
                  ↑
                </button>
              </div>
            </div>
            {chatError ? <p className={styles.errorText}>{chatError}</p> : null}
          </section>
        ) : null}

        <nav className={styles.tabBar}>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === "home" ? styles.tabButtonActive : ""}`}
            onClick={() => setActiveTab("home")}
          >
            <span className={styles.tabIcon}>{renderTabIcon("home")}</span>
            <span className={styles.tabLabel}>首页</span>
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === "script" ? styles.tabButtonActive : ""}`}
            onClick={() => setActiveTab("script")}
          >
            <span className={styles.tabIcon}>{renderTabIcon("script")}</span>
            <span className={styles.tabLabel}>人生剧本</span>
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === "chat" ? styles.tabButtonActive : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            <span className={styles.tabIcon}>{renderTabIcon("chat")}</span>
            <span className={styles.tabLabel}>问命</span>
          </button>
        </nav>
      </section>
    </main>
  );
}
