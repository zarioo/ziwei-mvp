/**
 * 这个文件集中维护评分引擎会反复用到的静态映射：
 * 1. 宫位中英文化 key
 * 2. 维度和宫位的展示名称
 * 3. 星曜、长生、四化的基础字典
 *
 * 之所以集中维护，而不是散落在 normalize / engine 多处，
 * 是为了让后续产品同学改规则时能先找到“名词字典层”，
 * 再去看具体的计算参数，降低阅读成本。
 */

export const PALACE_KEY_ORDER = [
  "life",
  "siblings",
  "spouse",
  "children",
  "wealth",
  "health",
  "travel",
  "social",
  "career",
  "property",
  "fortune",
  "parents",
] as const;

export type PalaceKey = (typeof PALACE_KEY_ORDER)[number];

export const DIMENSION_KEY_ORDER = [
  "total_luck",
  "career",
  "wealth",
  "romance",
  "health",
] as const;

export type DimensionKey = (typeof DIMENSION_KEY_ORDER)[number];

export const RELATION_TYPE_ORDER = [
  "main",
  "support",
  "triad",
  "weak_related",
] as const;

export type RelationType = (typeof RELATION_TYPE_ORDER)[number];

export const TRANSFORMATION_EFFECT_KEYS = ["lu", "quan", "ke", "ji"] as const;

export type TransformationEffectKey = (typeof TRANSFORMATION_EFFECT_KEYS)[number];

export const STAR_STATE_KEYS = [
  "temple",
  "prosperous",
  "neutral",
  "weak",
] as const;

export type StarStateKey = (typeof STAR_STATE_KEYS)[number];

export const PALACE_ZH_TO_KEY: Record<string, PalaceKey> = {
  命宫: "life",
  命: "life",
  兄弟宫: "siblings",
  兄弟: "siblings",
  夫妻宫: "spouse",
  夫妻: "spouse",
  子女宫: "children",
  子女: "children",
  财帛宫: "wealth",
  财帛: "wealth",
  疾厄宫: "health",
  疾厄: "health",
  迁移宫: "travel",
  迁移: "travel",
  交友宫: "social",
  交友: "social",
  官禄宫: "career",
  官禄: "career",
  田宅宫: "property",
  田宅: "property",
  福德宫: "fortune",
  福德: "fortune",
  父母宫: "parents",
  父母: "parents",
};

export const SLICE_MAPPING_KEY_TO_PALACE: Record<string, PalaceKey> = {
  life_palace: "life",
  sibling_palace: "siblings",
  spouse_palace: "spouse",
  children_palace: "children",
  wealth_palace: "wealth",
  health_palace: "health",
  travel_palace: "travel",
  friend_palace: "social",
  career_palace: "career",
  property_palace: "property",
  fortune_palace: "fortune",
  parent_palace: "parents",
};

export const PALACE_KEY_TO_ZH: Record<PalaceKey, string> = {
  life: "命宫",
  siblings: "兄弟",
  spouse: "夫妻",
  children: "子女",
  wealth: "财帛",
  health: "疾厄",
  travel: "迁移",
  social: "交友",
  career: "官禄",
  property: "田宅",
  fortune: "福德",
  parents: "父母",
};

export const DIMENSION_KEY_TO_ZH: Record<DimensionKey, string> = {
  total_luck: "总运",
  career: "事业",
  wealth: "财富",
  romance: "感情",
  health: "健康",
};

/**
 * 这里维护第一版会参与计算的星曜 key 映射。
 * 如果后续要补更多星曜，只需要在这里继续加，不会影响已有评分公式。
 */
export const STAR_ZH_TO_KEY: Record<string, string> = {
  紫微: "zi_wei",
  天府: "tian_fu",
  廉贞: "lian_zhen",
  武曲: "wu_qu",
  太阳: "tai_yang",
  太阴: "tai_yin",
  贪狼: "tan_lang",
  巨门: "ju_men",
  天相: "tian_xiang",
  天梁: "tian_liang",
  七杀: "qi_sha",
  破军: "po_jun",
  天机: "tian_ji",
  天同: "tian_tong",
  左辅: "left_support",
  右弼: "right_support",
  文昌: "wen_chang",
  文曲: "wen_qu",
  天魁: "tian_kui",
  天钺: "tian_yue",
  禄存: "lu_cun",
  天马: "tian_ma",
  擎羊: "qing_yang",
  陀罗: "tuo_luo",
  火星: "huo_xing",
  铃星: "ling_xing",
  地空: "di_kong",
  地劫: "di_jie",
  截路: "jie_lu",
  天刑: "tian_xing",
  天伤: "tian_shang",
  破碎: "po_sui",
};

export const HELPER_STAR_KEYS = new Set([
  "left_support",
  "right_support",
  "wen_chang",
  "wen_qu",
  "tian_kui",
  "tian_yue",
  "lu_cun",
  "tian_ma",
]);

export const MALEFIC_STAR_KEYS = new Set([
  "qing_yang",
  "tuo_luo",
  "huo_xing",
  "ling_xing",
  "di_kong",
  "di_jie",
  "jie_lu",
  "tian_xing",
  "tian_shang",
  "po_sui",
]);

export const STAR_STATE_ZH_TO_KEY: Record<string, StarStateKey> = {
  庙: "temple",
  旺: "prosperous",
  得: "prosperous",
  利: "prosperous",
  平: "neutral",
  不: "weak",
  陷: "weak",
};

export const TRANSFORMATION_EFFECT_ZH_TO_KEY: Record<string, TransformationEffectKey> = {
  化禄: "lu",
  化权: "quan",
  化科: "ke",
  化忌: "ji",
};

export const TRANSFORMATION_EFFECT_KEY_TO_ZH: Record<TransformationEffectKey, string> = {
  lu: "化禄",
  quan: "化权",
  ke: "化科",
  ji: "化忌",
};

export const CHANGSHENG_LABELS = new Set([
  "帝旺",
  "临官",
  "冠带",
  "长生",
  "养",
  "胎",
  "沐浴",
  "衰",
  "病",
  "死",
  "墓",
  "绝",
]);

export function toPalaceKey(raw: string | null | undefined): PalaceKey | null {
  if (!raw) return null;
  return PALACE_ZH_TO_KEY[raw.trim()] ?? null;
}

export function toStarKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return STAR_ZH_TO_KEY[raw.trim()] ?? null;
}
