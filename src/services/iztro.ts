/**
 * 这个文件负责统一封装 iztro 的排盘与运限获取，并加上缓存与输入校验。
 * 这样做是为了让 API 和脚本复用同一套稳定的数据入口，避免重复逻辑。
 */
import { astro } from "iztro";
import { LRUCache } from "lru-cache";
import { z } from "zod";

/**
 * 输入参数校验：把所有接口共用字段集中在这里，避免各处不一致。
 */
export const ZiweiBaseSchema = z.object({
  calendar: z.enum(["solar", "lunar"]).default("solar"),
  date: z
    .string()
    .regex(/^\d{4}-\d{1,2}-\d{1,2}$/, "日期必须是 YYYY-M-D 格式"),
  timeIndex: z.number().int().min(0).max(12),
  gender: z.enum(["男", "女"]),
  fixLeap: z.boolean().optional().default(true),
  isLeapMonth: z.boolean().optional().default(false),
  language: z.string().optional().default("zh-CN"),
});

export const ZiweiDecadalSchema = ZiweiBaseSchema.extend({
  daxianIndex: z.number().int().min(0),
});

export const ZiweiYearlySchema = ZiweiBaseSchema.extend({
  year: z.number().int().min(1),
});

export type ZiweiInput = z.infer<typeof ZiweiBaseSchema>;
export type ZiweiDecadalInput = z.infer<typeof ZiweiDecadalSchema>;
export type ZiweiYearlyInput = z.infer<typeof ZiweiYearlySchema>;

type FunctionalAstrolabe = ReturnType<typeof astro.bySolar>;

const natalCache = new LRUCache<string, FunctionalAstrolabe>({
  max: 500,
  ttl: 10 * 60 * 1000,
});

/**
 * 生成缓存 key，避免同一输入反复计算排盘。
 */
export function buildCacheKey(input: ZiweiInput): string {
  return [
    input.calendar,
    input.date,
    input.timeIndex,
    input.gender,
    String(input.fixLeap),
    String(input.isLeapMonth),
    input.language,
  ].join("|");
}

/**
 * 生成本命星盘对象（不含缓存）。
 *
 * @param input 排盘输入参数
 * @returns iztro 的 FunctionalAstrolabe 对象
 * @example
 * const astro = createAstrolabe({ calendar: "solar", date: "1984-7-24", timeIndex: 6, gender: "女" });
 */
export function createAstrolabe(input: ZiweiInput): FunctionalAstrolabe {
  const {
    calendar,
    date,
    timeIndex,
    gender,
    fixLeap,
    isLeapMonth,
    language,
  } = input;
  if (calendar === "lunar") {
    return astro.byLunar(date, timeIndex, gender, isLeapMonth, fixLeap, language);
  }
  return astro.bySolar(date, timeIndex, gender, fixLeap, language);
}

/**
 * 获取本命星盘对象（带缓存）。
 * 这样做是因为排盘计算开销大，且同一输入会被频繁调用。
 *
 * @param input 排盘输入参数
 * @returns iztro 的 FunctionalAstrolabe 对象
 */
export function getNatalAstrolabe(input: ZiweiInput): FunctionalAstrolabe {
  const key = buildCacheKey(input);
  const cached = natalCache.get(key);
  if (cached) {
    return cached;
  }
  const astrolabe = createAstrolabe(input);
  natalCache.set(key, astrolabe);
  return astrolabe;
}

/**
 * 获取指定日期的运限信息。
 *
 * @param astrolabe 本命星盘对象
 * @param targetDate 运限对应的日期
 * @param timeIndex 时辰索引（保持与出生时一致，避免偏差）
 * @returns iztro 的 FunctionalHoroscope 对象
 */
export function getHoroscope(
  astrolabe: FunctionalAstrolabe,
  targetDate: string | Date,
  timeIndex: number
) {
  return astrolabe.horoscope(targetDate, timeIndex);
}

/**
 * 根据年份获取流年运限。
 * 选用当年 1 月 1 日作为锚点，保证年份一致即可满足 MVP 需求。
 *
 * @param astrolabe 本命星盘对象
 * @param year 目标年份
 * @param timeIndex 时辰索引
 * @returns iztro 的 FunctionalHoroscope 对象
 */
export function getHoroscopeForYear(
  astrolabe: FunctionalAstrolabe,
  year: number,
  timeIndex: number
) {
  const target = new Date(year, 0, 1);
  return getHoroscope(astrolabe, target, timeIndex);
}

