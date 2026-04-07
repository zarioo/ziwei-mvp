import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * 保存 LLM JSON 数据的 API 接口
 * 
 * 功能：将前端生成的星盘 JSON 数据保存到 data/json-to-llm 文件夹
 * 文件名格式：llm-json-{timestamp}.json
 */
const DATA_DIR = path.join(process.cwd(), "data");
const JSON_TO_LLM_DIR = path.join(DATA_DIR, "json-to-llm");

async function ensureJsonToLlmDir() {
  // 确保 json-to-llm 目录存在
  await fs.mkdir(JSON_TO_LLM_DIR, { recursive: true });
}

function normalizeBaseName(rawName: unknown) {
  if (typeof rawName !== "string") return "";
  // 只保留常见安全字符，避免文件名带路径或特殊符号
  const safe = rawName
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return safe.slice(0, 80);
}

function normalizeFileName(rawName: unknown) {
  if (typeof rawName !== "string") return "";
  const safe = rawName.replace(/[/\\]/g, "").trim();
  if (!safe.endsWith(".json")) return "";
  return safe;
}

export async function GET(request: Request) {
  try {
    await ensureJsonToLlmDir();
    const { searchParams } = new URL(request.url);
    const fileName = normalizeFileName(searchParams.get("fileName"));
    if (!fileName) {
      return NextResponse.json(
        { success: false, error: "缺少合法 fileName 参数" },
        { status: 400 }
      );
    }

    const filePath = path.join(JSON_TO_LLM_DIR, fileName);
    const raw = await fs.readFile(filePath, "utf8");
    const jsonData = JSON.parse(raw);
    return NextResponse.json({ success: true, fileName, data: jsonData });
  } catch (error) {
    console.error("读取 LLM JSON 文件失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "读取失败",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // 确保目录存在
    await ensureJsonToLlmDir();
    
    // 读取请求体中的 JSON 数据，支持携带 fileBaseName 自定义文件名
    const body = await request.json();
    const fileBaseName = normalizeBaseName(body?.fileBaseName);
    const { fileBaseName: _ignored, ...jsonData } = body || {};

    // 若前端未传文件名，则回退为时间戳命名
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = fileBaseName
      ? `${fileBaseName}.json`
      : `llm-json-${timestamp}.json`;
    const filePath = path.join(JSON_TO_LLM_DIR, fileName);
    
    // 写入文件
    const payload = JSON.stringify(jsonData, null, 2);
    await fs.writeFile(filePath, payload, "utf8");
    
    return NextResponse.json({
      success: true,
      fileName,
      message: "JSON 文件保存成功",
    });
  } catch (error) {
    console.error("保存 LLM JSON 文件失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "保存失败",
      },
      { status: 500 }
    );
  }
}

