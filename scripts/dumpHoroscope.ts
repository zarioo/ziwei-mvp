/**
 * 这个脚本负责打印 iztro 的运限原始输出（含大限/流年等）。
 * 这样做是为了对照契约结构，确认哪些字段需要补齐或映射。
 */
import fs from "node:fs";
import path from "node:path";
import { astro } from "iztro";

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
  const horoscope = astrolabe.horoscope(new Date(), timeIndex);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(horoscope, null, 2));
}

main();

