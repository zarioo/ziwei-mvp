"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";

type ModelOption = {
  id: "kimi-thinking" | "gemini3pro" | "gpt53" | "seed-1-8-thinking";
  label: string;
  supportsFileUpload: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  createdAt: number;
};

type Conversation = {
  id: string;
  title: string;
  modelId: ModelOption["id"];
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

type Attachment = {
  name: string;
  content: string;
};

const MODELS: ModelOption[] = [
  { id: "kimi-thinking", label: "Kimi（Thinking）", supportsFileUpload: true },
  { id: "gemini3pro", label: "Gemini 3 Pro", supportsFileUpload: true },
  // 这里故意标记为不支持上传：发送时会自动把 JSON 拼到 prompt 下方，满足你的兜底需求
  { id: "gpt53", label: "GPT 5.3", supportsFileUpload: false },
  // ModelArk 的 Seed 1.8 支持 reasoning/thinking 流式内容，后端已默认打开 thinking
  {
    id: "seed-1-8-thinking",
    label: "ByteDance Seed 1.8（Thinking）",
    supportsFileUpload: true,
  },
];

const DEFAULT_PROMPT =
  "你是紫微斗数大师倪海厦，请你用毕生所学，为这位用户解析她的整体命运（json是她紫微斗数命盘及各个大限的数据），要求必须严谨，不要出现错误、实事求是、不要说客套话。";

const STORAGE_KEY = "ziwei-ai-chat-history-v1";

function createConversation(): Conversation {
  const now = Date.now();
  const id = `conv-${now}`;
  return {
    id,
    title: "新对话",
    // 新建会话默认使用 Seed 1.8（Thinking）
    modelId: "seed-1-8-thinking",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function buildTitle(messages: ChatMessage[]) {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "新对话";
  return firstUser.content.slice(0, 20) || "新对话";
}

function renderInlineMarkdown(text: string) {
  // 仅处理最常见的行内格式：**加粗**，避免引入额外依赖
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
  const nodes: ReactNode[] = [];
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
    // 支持四级标题，例如：#### 9. 85~94岁 长寿限
    if (line.startsWith("#### ")) {
      nodes.push(<h4 key={`h4-${index}`}>{renderInlineMarkdown(line.slice(5))}</h4>);
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

export default function AiChatPage() {
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState(DEFAULT_PROMPT);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [generatedJson, setGeneratedJson] = useState<Attachment | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDoneReason, setLastDoneReason] = useState<string | null>(null);

  const fileNameFromQuery = searchParams.get("fileName") || "";
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeId) || null,
    [conversations, activeId]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const first = createConversation();
        setConversations([first]);
        setActiveId(first.id);
        return;
      }
      const parsed = JSON.parse(raw) as Conversation[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const first = createConversation();
        setConversations([first]);
        setActiveId(first.id);
        return;
      }
      setConversations(parsed);
      setActiveId(parsed[0].id);
    } catch {
      const first = createConversation();
      setConversations([first]);
      setActiveId(first.id);
    }
  }, []);

  useEffect(() => {
    if (conversations.length === 0) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    // 自动加载“排盘页刚生成”的 JSON，用户不需要手动再找文件
    if (!fileNameFromQuery) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/llm-json?fileName=${encodeURIComponent(fileNameFromQuery)}`
        );
        const data = await res.json();
        if (!res.ok || !data?.data) return;
        if (cancelled) return;
        setGeneratedJson({
          name: fileNameFromQuery,
          content: JSON.stringify(data.data, null, 2),
        });
      } catch {
        // 忽略加载失败，不阻塞聊天
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileNameFromQuery]);

  const upsertActiveConversation = (updater: (prev: Conversation) => Conversation) => {
    setConversations((prev) =>
      prev.map((item) => (item.id === activeId ? updater(item) : item))
    );
  };

  const createNewChat = () => {
    const next = createConversation();
    setConversations((prev) => [next, ...prev]);
    setActiveId(next.id);
    setInput(DEFAULT_PROMPT);
    setAttachments([]);
    setError(null);
    setLastDoneReason(null);
  };

  const onSelectFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      next.push({ name: file.name, content: text });
    }
    // 追加而不是覆盖，方便多次上传后逐个删除管理
    setAttachments((prev) => [...prev, ...next]);
    // 清空 input 的值，允许再次选择同名文件也能触发 onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (name: string) => {
    setAttachments((prev) => prev.filter((file) => file.name !== name));
  };

  const removeGeneratedJson = () => {
    setGeneratedJson(null);
  };

  const onSend = async () => {
    if (!activeConversation || isStreaming) return;
    const trimmed = input.trim();
    if (!trimmed) return;

    setError(null);
    const selectedModel =
      MODELS.find((item) => item.id === activeConversation.modelId) || MODELS[0];
    const allFiles = [...attachments, ...(generatedJson ? [generatedJson] : [])];

    let mergedPrompt = trimmed;
    if (allFiles.length > 0) {
      const fileText = allFiles
        .map(
          (file) =>
            `【文件：${file.name}】\n\`\`\`\n${file.content}\n\`\`\``
        )
        .join("\n\n");
      if (selectedModel.supportsFileUpload) {
        // 统一通过文本拼接进入上下文，避免不同模型 SDK 的上传协议不一致
        mergedPrompt += `\n\n以下是用户上传的文件内容：\n${fileText}`;
      } else {
        mergedPrompt += `\n\n当前模型不支持文件直传，已自动附加 JSON/文本内容：\n${fileText}`;
      }
    }

    const now = Date.now();
    const userMessage: ChatMessage = {
      id: `msg-u-${now}`,
      role: "user",
      content: mergedPrompt,
      createdAt: now,
    };
    const assistantMessage: ChatMessage = {
      id: `msg-a-${now + 1}`,
      role: "assistant",
      content: "",
      reasoning: "",
      createdAt: now + 1,
    };

    upsertActiveConversation((prev) => {
      const nextMessages = [...prev.messages, userMessage, assistantMessage];
      return {
        ...prev,
        updatedAt: Date.now(),
        title: buildTitle(nextMessages),
        messages: nextMessages,
      };
    });

    setIsStreaming(true);
    setInput("");
    // 发送后立即清空附件展示区，避免“上一轮文件还挂在输入框旁边”
    setAttachments([]);
    setGeneratedJson(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    try {
      const requestMessages = [
        {
          role: "system",
          content:
            "你是严谨的紫微斗数分析助手。需要基于用户提供的命盘 JSON 进行实证推理，不编造事实。",
        },
        ...activeConversation.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: mergedPrompt },
      ];

      const res = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: activeConversation.modelId,
          messages: requestMessages,
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
      let doneReason = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          const lines = block.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            const event = JSON.parse(payload) as {
              type: "delta" | "reasoning" | "done" | "error" | "ping";
              text?: string;
              error?: string;
              reason?: string;
            };

            if (event.type === "error") {
              throw new Error(event.error || "流式输出失败");
            }
            if (event.type === "ping") {
              // 心跳包只用于保活，不参与渲染
              continue;
            }
            if (event.type === "done") {
              gotDone = true;
              doneReason = event.reason || "done";
              continue;
            }
            if (event.type === "delta" && event.text) {
              upsertActiveConversation((prev) => ({
                ...prev,
                updatedAt: Date.now(),
                messages: prev.messages.map((msg) =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: (msg.content || "") + event.text }
                    : msg
                ),
              }));
            }
            if (event.type === "reasoning" && event.text) {
              upsertActiveConversation((prev) => ({
                ...prev,
                updatedAt: Date.now(),
                messages: prev.messages.map((msg) =>
                  msg.id === assistantMessage.id
                    ? { ...msg, reasoning: (msg.reasoning || "") + event.text }
                    : msg
                ),
              }));
            }
          }
        }
      }
      if (!gotDone) {
        throw new Error("连接被提前关闭（未收到 done 事件）");
      }
      setLastDoneReason(doneReason || "done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <button className={styles.newChatButton} type="button" onClick={createNewChat}>
          + 新建对话
        </button>
        <div className={styles.historyList}>
          {conversations.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.historyItem} ${
                item.id === activeId ? styles.historyItemActive : ""
              }`}
              onClick={() => setActiveId(item.id)}
            >
              <span className={styles.historyTitle}>{item.title}</span>
              <span className={styles.historyMeta}>
                {new Date(item.updatedAt).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.serif}>天机ZEN · AI问命</h1>
          <div className={styles.controls}>
            <label className={styles.controlItem}>
              模型
              <select
                className={styles.select}
                value={activeConversation?.modelId || "seed-1-8-thinking"}
                onChange={(e) => {
                  const nextModel = e.target.value as ModelOption["id"];
                  upsertActiveConversation((prev) => ({ ...prev, modelId: nextModel }));
                }}
              >
                {MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <section className={styles.messages}>
          {(activeConversation?.messages || []).length === 0 ? (
            <div className={styles.emptyState}>
              已预置问命 Prompt，你可以直接发送，或先补充更多问题细节。
            </div>
          ) : (
            activeConversation?.messages.map((msg) => (
              <div
                key={msg.id}
                className={`${styles.messageItem} ${
                  msg.role === "assistant" ? styles.assistantItem : styles.userItem
                }`}
              >
                <div className={styles.messageRole}>
                  {msg.role === "assistant" ? "AI" : "你"}
                </div>
                {msg.reasoning ? (
                  <pre className={styles.reasoning}>{msg.reasoning}</pre>
                ) : null}
                {msg.role === "assistant" ? (
                  <div className={styles.messageText}>
                    <div className={styles.markdownBody}>{renderSimpleMarkdown(msg.content)}</div>
                  </div>
                ) : (
                  <pre className={styles.messageText}>{msg.content}</pre>
                )}
              </div>
            ))
          )}
        </section>

        <section className={styles.composer}>
          <div className={styles.inputShell}>
            <textarea
              className={styles.textarea}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="请输入你的问题..."
              rows={3}
            />
            {/* 把上传和发送收进输入框内，界面更接近常见聊天应用 */}
            <div className={styles.inputActions}>
              <label className={styles.iconButton} aria-label="上传文件" title="上传文件">
                <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.iconSvg}>
                  <path
                    d="M21.44 11.05L12.25 20.25a6 6 0 11-8.49-8.49l9.2-9.19a4 4 0 115.66 5.66l-9.2 9.2a2 2 0 01-2.83-2.83l8.49-8.48"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <input
                  type="file"
                  ref={fileInputRef}
                  className={styles.hiddenInput}
                  multiple
                  onChange={(e) => onSelectFiles(e.target.files)}
                />
              </label>

              <button
                className={`${styles.iconButton} ${styles.sendIconButton}`}
                type="button"
                onClick={onSend}
                disabled={isStreaming}
                aria-label={isStreaming ? "生成中" : "发送"}
                title={isStreaming ? "生成中" : "发送"}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.iconSvg}>
                  <path
                    d="M22 2L11 13"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M22 2L15 22L11 13L2 9L22 2Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className={styles.attachmentList}>
            {generatedJson ? (
              <span className={styles.attachmentTag}>
                自动载入：{generatedJson.name}
                <button
                  type="button"
                  className={styles.attachmentRemove}
                  onClick={removeGeneratedJson}
                  aria-label={`删除文件 ${generatedJson.name}`}
                >
                  删除
                </button>
              </span>
            ) : null}
            {attachments.map((file) => (
              <span key={file.name} className={styles.attachmentTag}>
                {file.name}
                <button
                  type="button"
                  className={styles.attachmentRemove}
                  onClick={() => removeAttachment(file.name)}
                  aria-label={`删除文件 ${file.name}`}
                >
                  删除
                </button>
              </span>
            ))}
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
          {!error && lastDoneReason ? (
            <p className={styles.note}>
              本次输出结束原因：{lastDoneReason}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}


