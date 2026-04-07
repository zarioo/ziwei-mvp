/**
 * 这个脚本负责对照契约字段清单，输出缺失的 key 路径。
 * 这样做是为了在迭代中快速知道还差哪些字段需要补齐。
 */
import fs from "node:fs";
import path from "node:path";
import { ZiweiBaseSchema, getNatalAstrolabe } from "../src/services/iztro";
import { mapNatal } from "../src/services/mapper";

function readInput() {
  const inputPath = path.resolve(process.cwd(), "ziweiInput.json");
  if (fs.existsSync(inputPath)) {
    return JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  }
  return {
    calendar: "solar",
    date: "1984-7-24",
    timeIndex: 6,
    gender: "女",
    fixLeap: true,
    isLeapMonth: false,
    language: "zh-CN",
  };
}

/**
 * 生成对象的 key 路径。
 * 以 contracts/wendy_keypaths.txt 的格式为准：数组用 [] 表示。
 */
function collectKeyPaths(value: unknown) {
  const set = new Set<string>();

  const walk = (node: unknown, pathKey: string) => {
    if (pathKey) set.add(pathKey);
    if (Array.isArray(node)) {
      const arrayKey = `${pathKey}[]`;
      set.add(arrayKey);
      node.forEach((item) => walk(item, arrayKey));
      return;
    }
    if (node && typeof node === "object") {
      Object.entries(node as Record<string, unknown>).forEach(
        ([key, val]) => {
          const next = pathKey ? `${pathKey}.${key}` : key;
          walk(val, next);
        }
      );
    }
  };

  walk(value, "");
  return set;
}

function main() {
  const raw = readInput();
  const parsed = ZiweiBaseSchema.parse(raw);
  const astrolabe = getNatalAstrolabe(parsed);
  const output = mapNatal(astrolabe, parsed);

  const expectedPath = path.resolve(
    process.cwd(),
    "contracts",
    "wendy_keypaths.txt"
  );
  const expected = fs
    .readFileSync(expectedPath, "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const actual = collectKeyPaths(output);
  const missing = expected.filter((key) => !actual.has(key));

  // eslint-disable-next-line no-console
  console.log(missing.join("\n"));
}

main();

