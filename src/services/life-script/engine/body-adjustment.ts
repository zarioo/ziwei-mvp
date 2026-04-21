import type { RelationType } from "../constants";
import type {
  DimensionWeightRule,
  LifeScriptRules,
  NormalizedDecade,
  NormalizedLifeScriptInput,
  NormalizedPalace,
} from "../types";
import { classifyPalaceRelation, getPalaceByIndex } from "./utils";

/**
 * 计算身宫细调。
 *
 * 身宫在第一版里不作为主导来源，只做“增强真实感的细调”：
 * - 如果身宫恰好落到当前维度的主宫或强相关宫，说明这个 decade 的体感更集中
 * - 但它不应该压过主宫/辅宫/三方四正，所以这里只返回一个轻量系数放大后的值
 */
export function calculateBodyAdjustment(params: {
  input: NormalizedLifeScriptInput;
  decade: NormalizedDecade;
  rule: DimensionWeightRule;
  rules: LifeScriptRules;
  bodyPalaceRawScore: number;
  mainPalace: NormalizedPalace | null;
  supportPalaces: NormalizedPalace[];
  triadPalaces: NormalizedPalace[];
}) {
  const bodyPalace = getPalaceByIndex(params.input, params.input.body_palace_index);
  if (!bodyPalace) {
    return {
      score: 0,
      relation: "none" as const,
      palace_index: null,
    };
  }

  const relation = classifyPalaceRelation(
    bodyPalace,
    params.mainPalace,
    params.supportPalaces,
    params.triadPalaces
  ) as RelationType;
  const coeff = params.rules.body_adjustment.relation_coeff[relation] ?? 0;

  return {
    score: params.bodyPalaceRawScore * coeff,
    relation,
    palace_index: bodyPalace.index,
  };
}
