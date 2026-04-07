import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

async function ensureDataDir() {
  // 确保本地 data 目录存在，便于保存登录会话和星盘记录
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, fileName);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    // 文件不存在或解析失败时使用默认值，保证流程不中断
    return fallback;
  }
}

export async function writeJson<T>(fileName: string, data: T): Promise<void> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, fileName);
  const payload = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, payload, "utf8");
}

