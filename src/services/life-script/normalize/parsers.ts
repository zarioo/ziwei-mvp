import {
  CHANGSHENG_LABELS,
  HELPER_STAR_KEYS,
  MALEFIC_STAR_KEYS,
  PALACE_ZH_TO_KEY,
  SLICE_MAPPING_KEY_TO_PALACE,
  STAR_STATE_ZH_TO_KEY,
  TRANSFORMATION_EFFECT_ZH_TO_KEY,
  toPalaceKey,
  toStarKey,
} from "../constants";
import type {
  NormalizedCategorizedStars,
  NormalizedRiskAlert,
  NormalizedStar,
  NormalizedTransformation,
} from "../types";

/**
 * 解析主星 / 辅星字符串。
 *
 * 原始字符串可能来自多个来源，格式未必完全稳定。
 * 因此这里采用“尽量解析 + 保底保留 raw”的策略：
 * 1. 能拆出星名、庙旺平陷、标签就拆
 * 2. 拆不完整也不要中断主流程
 *
 * 评分引擎的产品定位是“确定性出图”，
 * 所以容错要优先于洁癖，不能因为单颗星格式脏就整份剧本失败。
 */
export function parseStar(raw: string | null | undefined): NormalizedStar {
  const source = typeof raw === "string" ? raw.trim() : "";
  if (!source) {
    return {
      raw: "",
      name_zh: null,
      name_key: null,
      state_zh: null,
      state_key: null,
      tags: [],
      natal_transformations: [],
    };
  }

  const tags = Array.from(source.matchAll(/\[([^\]]+)\]/g)).map((match) =>
    match[1].trim()
  );
  const stateMatch = source.match(/\(([^)]+)\)/);
  const stateZh = stateMatch?.[1]?.trim() || null;

  const nameMatch = source.match(/^([^\[(\-]+)/);
  const nameZh = nameMatch?.[1]?.trim() || source.replace(/\[.*$/, "").trim();
  const natal_transformations = tags
    .filter((tag) => tag.startsWith("生年"))
    .map((tag) => {
      const effectZh = `化${tag.replace(/^生年/, "").trim()}`;
      return {
        tag,
        effect_zh: effectZh,
        effect_key: TRANSFORMATION_EFFECT_ZH_TO_KEY[effectZh] ?? null,
      };
    });

  return {
    raw: source,
    name_zh: nameZh || null,
    name_key: toStarKey(nameZh),
    state_zh: stateZh,
    state_key: stateZh ? STAR_STATE_ZH_TO_KEY[stateZh] ?? null : null,
    tags,
    natal_transformations,
  };
}

/**
 * 把 minor_stars / mini_stars / misc_gods 归类成“可计算结构”。
 *
 * 第一版并不追求把所有神煞都映射成复杂对象，
 * 重点是先区分出：哪些明确参与加分、哪些明确参与扣分、哪些先留作轻修正。
 */
export function categorizeSideStars(
  minorStars: string[] | undefined,
  miniStars: string[] | undefined,
  miscGods: Record<string, string | undefined> | undefined
): NormalizedCategorizedStars {
  const helper_stars: NormalizedStar[] = [];
  const malefic_stars: NormalizedStar[] = [];
  const shensha: string[] = [];
  const other_tags: string[] = [];

  for (const raw of [...(minorStars ?? []), ...(miniStars ?? [])]) {
    const parsed = parseStar(raw);
    if (parsed.name_key && HELPER_STAR_KEYS.has(parsed.name_key)) {
      helper_stars.push(parsed);
      continue;
    }
    if (parsed.name_key && MALEFIC_STAR_KEYS.has(parsed.name_key)) {
      malefic_stars.push(parsed);
      continue;
    }
    if (parsed.name_zh) {
      other_tags.push(parsed.name_zh);
    } else if (parsed.raw) {
      other_tags.push(parsed.raw);
    }
  }

  for (const value of Object.values(miscGods ?? {})) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) continue;
    if (CHANGSHENG_LABELS.has(text)) {
      other_tags.push(text);
      continue;
    }
    shensha.push(text);
  }

  return {
    helper_stars,
    malefic_stars,
    shensha,
    other_tags,
  };
}

export function parseDecadeMapping(
  mapping: Record<
    string,
    {
      target_static_index?: number | null;
    }
  > | null | undefined
) {
  const normalized: Record<
    | "life"
    | "siblings"
    | "spouse"
    | "children"
    | "wealth"
    | "health"
    | "travel"
    | "social"
    | "career"
    | "property"
    | "fortune"
    | "parents",
    number | null
  > = {
    life: null,
    siblings: null,
    spouse: null,
    children: null,
    wealth: null,
    health: null,
    travel: null,
    social: null,
    career: null,
    property: null,
    fortune: null,
    parents: null,
  };

  for (const [rawKey, value] of Object.entries(mapping ?? {})) {
    const palaceKey = SLICE_MAPPING_KEY_TO_PALACE[rawKey];
    if (!palaceKey) continue;
    normalized[palaceKey] =
      typeof value?.target_static_index === "number" ? value.target_static_index : null;
  }

  return normalized;
}

export function parseTransformation(
  raw: string | null | undefined
): NormalizedTransformation {
  const source = typeof raw === "string" ? raw.trim() : "";
  const match = source.match(/^(.+?)(化禄|化权|化科|化忌)$/);
  const starZh = match?.[1]?.trim() || null;
  const effectZh = match?.[2]?.trim() || null;
  return {
    raw: source,
    star_zh: starZh,
    star_key: toStarKey(starZh),
    effect_zh: effectZh,
    effect_key: effectZh ? TRANSFORMATION_EFFECT_ZH_TO_KEY[effectZh] ?? null : null,
  };
}

/**
 * risk_alert 也是“尽量解析 + 保底兜底”。
 *
 * 原因是这类字段通常来自自然语言模板，未来很可能追加更多描述词。
 * 如果这里写成“必须完全匹配”，一旦模板稍变就会导致主流程报错，
 * 对产品来说是非常不划算的风险。
 */
export function parseRiskAlert(
  raw: string | null | undefined
): NormalizedRiskAlert | null {
  const source = typeof raw === "string" ? raw.trim() : "";
  if (!source) return null;

  const match = source.match(
    /^(.+?)-.+?(化禄|化权|化科|化忌)\s+入\s+本命(.+?)\s+冲\s+本命(.+)$/
  );

  if (!match) {
    return { raw: source };
  }

  const [, starZh, effectZh, enterPalaceZh, conflictPalaceZh] = match;

  return {
    raw: source,
    star_zh: starZh.trim(),
    star_key: toStarKey(starZh.trim()),
    effect_zh: effectZh.trim(),
    effect_key: TRANSFORMATION_EFFECT_ZH_TO_KEY[effectZh.trim()] ?? null,
    enter_palace_zh: enterPalaceZh.trim(),
    enter_palace_key: toPalaceKey(enterPalaceZh.trim()),
    conflict_palace_zh: conflictPalaceZh.trim(),
    conflict_palace_key: toPalaceKey(conflictPalaceZh.trim()),
  };
}

export function normalizePalaceName(raw: string | null | undefined) {
  const text = typeof raw === "string" ? raw.trim() : "";
  const palaceKey = PALACE_ZH_TO_KEY[text];
  return {
    palace_key: palaceKey ?? null,
    name_zh: text,
  };
}

export function deriveBirthYearFromDecades(
  decades: Array<{ start_age: number | null; target_year: number | null }>
) {
  for (const decade of decades) {
    if (typeof decade.start_age === "number" && typeof decade.target_year === "number") {
      return decade.target_year - decade.start_age;
    }
  }
  return null;
}
