/**
 * 拉取本地 API 输出并写入固定 JSON 文件，便于排查映射问题。
 */
import fs from "node:fs";
import path from "node:path";

type ZiweiInput = {
  calendar: "solar" | "lunar";
  date: string;
  timeIndex: number;
  gender: "男" | "女";
  fixLeap?: boolean;
  isLeapMonth?: boolean;
  language?: string;
  daxianIndex?: number;
  year?: number;
};

function readInput(): ZiweiInput {
  const inputPath = path.resolve(process.cwd(), "ziweiInput.json");
  if (!fs.existsSync(inputPath)) {
    throw new Error("缺少 ziweiInput.json，请先准备排盘输入。");
  }
  return JSON.parse(fs.readFileSync(inputPath, "utf-8"));
}

async function postJson(apiBase: string, endpoint: string, body: unknown) {
  const res = await fetch(`${apiBase}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`[${res.status}] ${endpoint} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function writeJson(filename: string, data: unknown) {
  const filePath = path.resolve(process.cwd(), filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function main() {
  const apiBase = process.env.ZIWEI_API_BASE || "http://localhost:3000";
  const input = readInput();

  const natal = await postJson(apiBase, "/api/ziwei/natal", input);
  writeJson("ziweiApiOutput.json", natal);

  const decadal = await postJson(apiBase, "/api/ziwei/decadal", {
    ...input,
    daxianIndex: input.daxianIndex ?? 3,
  });
  writeJson("decadalApiOutput.json", decadal);

  const yearly = await postJson(apiBase, "/api/ziwei/yearly", {
    ...input,
    year: input.year ?? new Date().getFullYear(),
  });
  writeJson("yearlyApiOutput.json", yearly);

  // eslint-disable-next-line no-console
  console.log("已写入: ziweiApiOutput.json / decadalApiOutput.json / yearlyApiOutput.json");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


