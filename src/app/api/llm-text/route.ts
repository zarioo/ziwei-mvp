import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const JSON_TO_LLM_DIR = path.join(DATA_DIR, "json-to-llm");

async function ensureJsonToLlmDir() {
  await fs.mkdir(JSON_TO_LLM_DIR, { recursive: true });
}

function normalizeBaseName(rawName: unknown) {
  if (typeof rawName !== "string") return "";
  const safe = rawName
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return safe.slice(0, 80);
}

export async function POST(request: Request) {
  try {
    await ensureJsonToLlmDir();

    const body = (await request.json().catch(() => ({}))) as {
      content?: unknown;
      fileBaseName?: unknown;
    };
    const content =
      typeof body.content === "string" ? body.content : "";
    if (!content.trim()) {
      return NextResponse.json(
        { success: false, error: "缺少合法文本内容" },
        { status: 400 }
      );
    }

    const fileBaseName = normalizeBaseName(body.fileBaseName);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = fileBaseName
      ? `${fileBaseName}.txt`
      : `llm-text-${timestamp}.txt`;
    const filePath = path.join(JSON_TO_LLM_DIR, fileName);

    await fs.writeFile(filePath, content, "utf8");

    return NextResponse.json({
      success: true,
      fileName,
      message: "文本文件保存成功",
    });
  } catch (error) {
    console.error("保存 LLM 文本文件失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "保存失败",
      },
      { status: 500 }
    );
  }
}
