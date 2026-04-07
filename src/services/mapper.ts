/**
 * 这个文件负责把 iztro 原始数据映射到契约结构，保证字段齐全。
 * 这样做的原因是前端只要依赖契约结构，就不需要理解 iztro 的内部细节。
 */
import type { ZiweiInput } from "./iztro";
import { getHoroscopeForYear } from "./iztro";

const DIZHI_ORDER = [
  "子",
  "丑",
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
];

type FunctionalAstrolabe = ReturnType<
  typeof import("iztro").astro.bySolar
>;
type FunctionalStar = {
  name?: string;
  type?: string;
  brightness?: string;
  mutagen?: string;
};

/**
 * 将星曜对象映射到契约星曜结构。
 * 映射关系：iztro.star.name/type/brightness/mutagen -> 契约 name/type/brightness/sihua。
 *
 * @param star iztro 的星曜对象
 * @returns 契约里的星曜结构
 * @example
 * mapStar({ name: "紫微", type: "major", brightness: "庙", mutagen: "禄" })
 */
function mapStar(star: FunctionalStar) {
  const sihua = star?.mutagen ? `化${star.mutagen}` : null;
  return {
    name: star?.name ?? null,
    displayName: star?.name ?? null,
    type: star?.type ?? null,
    brightness: star?.brightness ?? null,
    sihua,
  };
}

/**
 * 生成“本命盘十二宫”数据。
 * 映射关系：iztro.palaces[*] -> 契约 palaces[*]，主/辅星来自 majorStars/minorStars/adjectiveStars。
 *
 * @param astrolabe iztro 本命星盘
 * @returns 契约结构的 palaces 数组
 * @example
 * mapPalaces(astrolabe)
 */
export function mapPalaces(astrolabe: FunctionalAstrolabe) {
  return (astrolabe.palaces || []).map((palace: any) => {
    const palaceName = normalizePalaceName(palace.name);
    const minorStars = [
      ...(palace.minorStars || []),
      ...(palace.adjectiveStars || []),
    ];
    return {
      name: palaceName ?? null,
      key: mapPalaceKey(palaceName),
      displayName: palaceName ?? null,
      dizhi: palace.earthlyBranch ?? null,
      tianGan: palace.heavenlyStem ?? null,
      position: palace.index ?? null,
      majorStars: (palace.majorStars || []).map(mapStar),
      minorStars: minorStars.map(mapStar),
      sihuaStars: [],
      changsheng: palace.changsheng12 ?? null,
      boshi: palace.boshi12 ?? null,
      suiQian: palace.suiqian12 ?? null,
      jiangQian: palace.jiangqian12 ?? null,
      isBodyPalace: Boolean(palace.isBodyPalace),
      xiaoxianAges: palace.ages ?? [],
      liunianAges: palace.ages ?? [],
    };
  });
}

/**
 * 映射本命四化。
 * 映射关系：宫位内星曜的 mutagen -> 契约 sihua.bensheng[]。
 *
 * @param astrolabe iztro 本命星盘
 * @returns 契约结构的本命四化数组
 * @example
 * mapBenShengSihua(astrolabe)
 */
export function mapBenShengSihua(astrolabe: FunctionalAstrolabe) {
  const result: Array<{
    star: string | null;
    sihua: string | null;
    palace: string | null;
    tianGan: string | null;
  }> = [];

  (astrolabe.palaces || []).forEach((palace: any) => {
    const palaceName = normalizePalaceName(palace.name);
    const stars = [
      ...(palace.majorStars || []),
      ...(palace.minorStars || []),
      ...(palace.adjectiveStars || []),
    ];
    stars.forEach((star: any) => {
      if (!star?.mutagen) return;
      result.push({
        star: star.name ?? null,
        sihua: `化${star.mutagen}`,
        palace: palaceName ?? null,
        tianGan: palace.heavenlyStem ?? null,
      });
    });
  });

  return result;
}

/**
 * 映射大限摘要。
 * 映射关系：iztro.palaces[*].decadal -> 契约 daxian[]。
 *
 * @param astrolabe iztro 本命星盘
 * @returns 契约结构的大限索引数组
 * @example
 * mapDecadalIndex(astrolabe)
 */
export function mapDecadalIndex(astrolabe: FunctionalAstrolabe) {
  return (astrolabe.palaces || []).map((palace: any) => {
    const palaceName = normalizePalaceName(palace.name);
    const range = palace.decadal?.range || [null, null];
    const startAge = range?.[0] ?? null;
    const endAge = range?.[1] ?? null;
    return {
      index: palace.index != null ? palace.index + 1 : null,
      ageRange:
        startAge != null && endAge != null ? `${startAge}~${endAge}` : "",
      startAge,
      endAge,
      palace: palaceName ?? null,
      palacePosition: palace.index ?? null,
      tianGan: palace.decadal?.heavenlyStem ?? null,
      dizhi: palace.decadal?.earthlyBranch ?? null,
      dizhiIndex: getDizhiIndex(palace.decadal?.earthlyBranch),
      sihua: [],
      stars: [],
    };
  });
}

/**
 * 映射流年摘要。
 * 映射关系：horoscope.yearly -> 契约 liunian[]。
 *
 * @param astrolabe iztro 本命星盘
 * @param timeIndex 时辰索引
 * @param count 输出条数
 * @returns 契约结构的流年索引数组
 * @example
 * mapYearlyIndex(astrolabe, 6, 12)
 */
export function mapYearlyIndex(
  astrolabe: FunctionalAstrolabe,
  timeIndex: number,
  count = 12
) {
  const birthYear = getBirthYear(astrolabe);
  const baseYear = birthYear ?? new Date().getFullYear();
  const items = [];
  for (let i = 0; i < count; i += 1) {
    const year = baseYear + i;
    const horoscope = getHoroscopeForYear(astrolabe, year, timeIndex);
    const yearly = horoscope?.yearly;
    const palace = astrolabe.palaces?.[yearly?.index ?? -1];
    const palaceName = normalizePalaceName(palace?.name);
    items.push({
      year,
      age: birthYear ? year - birthYear + 1 : null,
      palace: palaceName ?? null,
      palacePosition: yearly?.index ?? null,
      tianGan: yearly?.heavenlyStem ?? null,
      dizhi: yearly?.earthlyBranch ?? null,
      dizhiIndex: getDizhiIndex(yearly?.earthlyBranch),
      sihua: [],
      stars: [],
    });
  }
  return items;
}

/**
 * 输出本命盘契约结构。
 * 映射关系：astrolabe 基础字段 -> 契约基础字段；palaces/daxian/liunian 使用各自 mapper。
 *
 * @param astrolabe iztro 本命星盘
 * @param input 输入参数（用于语言与性别输出一致）
 * @returns 对齐契约的本命盘结构
 * @example
 * mapNatal(astrolabe, { calendar: "solar", date: "1984-7-24", timeIndex: 6, gender: "女" })
 */
export function mapNatal(
  astrolabe: FunctionalAstrolabe,
  input: ZiweiInput
) {
  const birthYear = getBirthYear(astrolabe);
  const birthDateParts = parseYMD(astrolabe.solarDate);
  const lunar = astrolabe.rawDates?.lunarDate;
  return {
    version: 6,
    language: mapLanguage(input.language),
    gender: input.gender === "男" ? "male" : "female",
    solarBirthDate: formatChineseDate(astrolabe.solarDate),
    lunarBirthDate: lunar?.toString?.(true) ?? null,
    solarBirthDateISO: astrolabe.solarDate ?? null,
    lunarYear: lunar?.lunarYear ?? null,
    lunarMonth: lunar?.lunarMonth ?? null,
    lunarMonthRaw: lunar?.lunarMonth ?? null,
    lunarDay: lunar?.lunarDay ?? null,
    lunarIsLeapMonth: lunar?.isLeap ?? null,
    birthTime: { hour: null, minute: null },
    inputBirthTime: { hour: null, minute: null },
    trueSolarBirthTime: { hour: null, minute: null },
    timeAdjustment: null,
    birthYear: birthDateParts.year ?? birthYear ?? null,
    birthMonth: birthDateParts.month ?? null,
    birthDay: birthDateParts.day ?? null,
    birthHour: null,
    wuxingju: astrolabe.fiveElementsClass ?? null,
    mingzhu: astrolabe.soul ?? null,
    shenzhu: astrolabe.body ?? null,
    mingPalacePosition: getPalacePosition(astrolabe, "命宫"),
    bodyPalacePosition: getBodyPalacePosition(astrolabe),
    laiyinPalacePosition: null,
    doujun: null,
    palaces: mapPalaces(astrolabe),
    sihua: {
      bensheng: mapBenShengSihua(astrolabe),
      dayun: [],
      liunian: [],
    },
    daxian: mapDecadalIndex(astrolabe),
    liunian: mapYearlyIndex(astrolabe, input.timeIndex, 12),
    id: "",
  };
}

/**
 * 输出指定大限结构（完整字段，缺失填空）。
 * 映射关系：iztro.palaces[daxianIndex].decadal -> 契约 daxian 结构。
 *
 * @param astrolabe iztro 本命星盘
 * @param daxianIndex 输入的大限索引
 * @returns 契约结构的大限对象
 * @example
 * mapDecadal(astrolabe, 3)
 */
export function mapDecadal(
  astrolabe: FunctionalAstrolabe,
  daxianIndex: number
) {
  const idx =
    daxianIndex >= 1 && daxianIndex <= 12 ? daxianIndex - 1 : daxianIndex;
  const palace = astrolabe.palaces?.[idx];
  const palaceName = normalizePalaceName(palace?.name);
  const range = palace?.decadal?.range || [null, null];
  const startAge = range?.[0] ?? null;
  const endAge = range?.[1] ?? null;
  return {
    index: palace?.index != null ? palace.index + 1 : null,
    ageRange:
      startAge != null && endAge != null ? `${startAge}~${endAge}` : "",
    startAge,
    endAge,
    palace: palaceName ?? null,
    palacePosition: palace?.index ?? null,
    tianGan: palace?.decadal?.heavenlyStem ?? null,
    dizhi: palace?.decadal?.earthlyBranch ?? null,
    dizhiIndex: getDizhiIndex(palace?.decadal?.earthlyBranch),
    sihua: [],
    stars: [],
  };
}

/**
 * 输出指定流年结构（完整字段，缺失填空）。
 * 映射关系：horoscope.yearly -> 契约 liunian 单条结构。
 *
 * @param astrolabe iztro 本命星盘
 * @param year 目标年份
 * @param timeIndex 时辰索引
 * @returns 契约结构的流年对象
 * @example
 * mapYearly(astrolabe, 1984, 6)
 */
export function mapYearly(
  astrolabe: FunctionalAstrolabe,
  year: number,
  timeIndex: number
) {
  const horoscope = getHoroscopeForYear(astrolabe, year, timeIndex);
  const yearly = horoscope?.yearly;
  const palace = astrolabe.palaces?.[yearly?.index ?? -1];
  const palaceName = normalizePalaceName(palace?.name);
  const birthYear = getBirthYear(astrolabe);
  return {
    year,
    age: birthYear ? year - birthYear + 1 : null,
    palace: palaceName ?? null,
    palacePosition: yearly?.index ?? null,
    tianGan: yearly?.heavenlyStem ?? null,
    dizhi: yearly?.earthlyBranch ?? null,
    dizhiIndex: getDizhiIndex(yearly?.earthlyBranch),
    sihua:
      yearly?.mutagen?.map((star: string) => ({
        star,
        sihua: null,
        palace: null,
        tianGan: yearly?.heavenlyStem ?? null,
      })) ?? [],
    stars: [],
  };
}

function mapPalaceKey(name?: string) {
  const map: Record<string, string> = {
    命宫: "ming",
    兄弟宫: "xiongdi",
    夫妻宫: "fuqi",
    子女宫: "zinv",
    财帛宫: "caibo",
    疾厄宫: "jie",
    迁移宫: "qianyi",
    交友宫: "jiaoyou",
    官禄宫: "guanlu",
    田宅宫: "tianzhai",
    福德宫: "fude",
    父母宫: "fumu",
  };
  return name ? map[name] ?? "" : "";
}

function normalizePalaceName(name?: string) {
  if (!name) return name;
  // 前端展示需要统一“仆役”为“交友”，避免用户看到旧称呼
  if (name === "仆役") return "交友";
  if (name === "仆役宫") return "交友宫";
  return name;
}

function getDizhiIndex(dizhi?: string) {
  if (!dizhi) return null;
  const idx = DIZHI_ORDER.indexOf(dizhi);
  return idx >= 0 ? idx : null;
}

function getBirthYear(astrolabe: FunctionalAstrolabe) {
  const parts = parseYMD(astrolabe.solarDate);
  return parts.year ?? null;
}

function getPalacePosition(astrolabe: FunctionalAstrolabe, name: string) {
  const palace = astrolabe.palaces?.find((p: any) => p.name === name);
  return palace?.index ?? null;
}

function getBodyPalacePosition(astrolabe: FunctionalAstrolabe) {
  const palace = astrolabe.palaces?.find((p: any) => p.isBodyPalace);
  return palace?.index ?? null;
}

function parseYMD(dateStr?: string) {
  if (!dateStr) return { year: null, month: null, day: null };
  const [y, m, d] = dateStr.split("-").map((v) => Number(v));
  return { year: y || null, month: m || null, day: d || null };
}

function formatChineseDate(dateStr?: string) {
  const { year, month, day } = parseYMD(dateStr);
  if (!year || !month || !day) return null;
  return `${year}年${month}月${day}日`;
}

function mapLanguage(language?: string) {
  if (!language) return "zh";
  if (language.startsWith("zh")) return "zh";
  return language;
}

