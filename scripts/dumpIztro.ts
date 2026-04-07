/**
 * 这个脚本负责打印 iztro 的原始本命盘输出，便于对照契约补齐字段。
 * 这样做是为了让排盘映射在迭代时有“真实来源”可参考。
 */
import fs from "node:fs";
import path from "node:path";
import { astro } from "iztro";

/**
 * 读取输入参数（优先读取项目内 ziweiInput.json）。
 * 这样做是为了复用固定测试数据，减少手动输入。
 */
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
 * 执行并打印结果。
 */
function main() {
  const input = readInput();
  const {
    calendar,
    date,
    timeIndex,
    gender,
    fixLeap = true,
    isLeapMonth = false,
    language = "zh-CN",
  } = input;
  const astrolabe =
    calendar === "lunar"
      ? astro.byLunar(date, timeIndex, gender, isLeapMonth, fixLeap, language)
      : astro.bySolar(date, timeIndex, gender, fixLeap, language);
  // 直接打印原始结构，便于对照字段
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(astrolabe, null, 2));
}

main();

