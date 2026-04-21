import { PALACE_KEY_ORDER } from "../constants";
import type {
  DimensionWeightRule,
  NormalizedDecade,
  NormalizedLifeScriptInput,
  NormalizedPalace,
} from "../types";
import type { PalaceKey, RelationType } from "../constants";

export function getPalaceByIndex(
  input: NormalizedLifeScriptInput,
  index: number | null | undefined
) {
  if (typeof index !== "number") return null;
  return input.static_palaces.find((palace) => palace.index === index) ?? null;
}

export function getMappedPalace(
  input: NormalizedLifeScriptInput,
  decade: NormalizedDecade,
  palaceKey: PalaceKey
) {
  return getPalaceByIndex(input, decade.mapping[palaceKey]);
}

export function getTriadPalaces(
  input: NormalizedLifeScriptInput,
  referencePalace: NormalizedPalace | null
) {
  if (!referencePalace) return [];
  const indices = [
    referencePalace.relationships.opposite_index,
    referencePalace.relationships.wealth_trine_index,
    referencePalace.relationships.career_trine_index,
  ].filter((value): value is number => typeof value === "number");

  return Array.from(new Set(indices))
    .map((index) => getPalaceByIndex(input, index))
    .filter((palace): palace is NormalizedPalace => Boolean(palace));
}

/**
 * 判定某个静态宫在当前维度中属于 main / support / triad / weak_related。
 *
 * 这一步很关键，因为四化、风险、身宫都不是“全局无差别生效”。
 * 同一颗星落在与当前维度高度相关的宫位，产品上必须比弱相关宫位更有分量，
 * 否则图文会显得不可信。
 */
export function classifyPalaceRelation(
  palace: NormalizedPalace,
  mainPalace: NormalizedPalace | null,
  supportPalaces: NormalizedPalace[],
  triadPalaces: NormalizedPalace[]
): RelationType {
  if (mainPalace && palace.index === mainPalace.index) {
    return "main";
  }
  if (supportPalaces.some((item) => item.index === palace.index)) {
    return "support";
  }
  if (triadPalaces.some((item) => item.index === palace.index)) {
    return "triad";
  }
  return "weak_related";
}

export function getMainPalaceKey(rule: DimensionWeightRule) {
  return (
    PALACE_KEY_ORDER.find((palaceKey) => typeof rule.main[palaceKey] === "number") ?? "life"
  );
}

/**
 * 原始分线性归一到 0~100。
 *
 * 不能直接拿原始累加值做最终分，原因有两个：
 * 1. 原始值是不同来源的混合量纲，既有星曜基础分，也有风险惩罚和四化修正。
 * 2. 图表、排序、付费前摘要都需要稳定落在同一可视化尺度上。
 *
 * 因此第一版采用独立 normalize 模块，把经验区间映射到 0~100，
 * 后续如果产品希望“整体更高”或“整体更保守”，只改配置即可。
 */
export function normalizeScore(raw: number, minRaw: number, maxRaw: number) {
  if (maxRaw <= minRaw) {
    return 0;
  }
  return (raw - minRaw) / (maxRaw - minRaw);
}

/**
 * 最终分必须 clamp 到 0~100。
 *
 * 这是给前端图表、排名和付费摘要提供稳定合同。
 * 即使内部累计过程出现极端值，也不允许把可视化结果炸出边界。
 */
export function clampScore(score: number) {
  if (!Number.isFinite(score)) return 45;
  return Math.max(45, Math.min(100, Math.round(score * 100) / 100));
}
