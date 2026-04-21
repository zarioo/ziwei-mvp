import type { DimensionKey } from "../constants";
import { DIMENSION_KEY_TO_ZH, PALACE_KEY_TO_ZH } from "../constants";
import type {
  ChangshengTrace,
  LifeScriptRules,
  MajorStarContributionTrace,
  MiscGodContributionTrace,
  NormalizedDecade,
  NormalizedLifeScriptInput,
  NormalizedPalace,
  PalaceContributionBreakdown,
  PalaceScoreDebug,
  SideStarContributionTrace,
  TransformationContributionTrace,
} from "../types";

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function scoreBase(
  starKey: string | null,
  dimension: DimensionKey,
  table: Record<string, Partial<Record<DimensionKey, number>>>
) {
  if (!starKey) return 0;
  return table[starKey]?.[dimension] ?? 0;
}

function scoreStateCoeff(stateKey: string | null, rules: LifeScriptRules) {
  if (!stateKey) return 1;
  return rules.star_state_coeff[stateKey as keyof typeof rules.star_state_coeff] ?? 1;
}

function scorePalaceAffinity(
  starKey: string | null,
  palaceKey: NormalizedPalace["palace_key"],
  rules: LifeScriptRules
) {
  if (!starKey) return 1;
  return rules.palace_affinity[starKey]?.[palaceKey] ?? 1;
}

function capPositiveOnly(value: number, upperBound: number) {
  if (value <= upperBound) return value;
  return upperBound;
}

function clampBetween(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function countJiTransformationsForPalace(
  palace: NormalizedPalace,
  transformations: NormalizedDecade["transformations"]
) {
  const decadeJiCount = (() => {
    const starKeys = new Set(
      [...palace.major_stars, ...palace.helper_stars, ...palace.malefic_stars]
        .map((star) => star.name_key)
        .filter((starKey): starKey is string => Boolean(starKey))
    );
    return transformations.filter(
      (item) => item.effect_key === "ji" && item.star_key && starKeys.has(item.star_key)
    ).length;
  })();

  const natalJiCount = [...palace.major_stars, ...palace.helper_stars, ...palace.malefic_stars]
    .flatMap((star) => star.natal_transformations)
    .filter((item) => item.effect_key === "ji").length;

  return decadeJiCount + natalJiCount;
}

/**
 * 计算某个“静态宫位在某个维度上的单宫原始分”。
 *
 * 按最新 PDF 规则，单宫原始分严格拆成五个模块：
 * 1. 主星模块分
 * 2. 辅星模块分
 * 3. 静态修正模块分
 * 4. 生年四化修正分
 * 5. 大限四化修正分
 *
 * 这里不再处理 risk_alert，因为风险提示已经改成“维度层修正”，
 * 不能继续像旧版那样分散扣进每个宫位，否则会和 PDF 公式不一致。
 */
export function calculatePalaceScore(params: {
  input: NormalizedLifeScriptInput;
  palace: NormalizedPalace;
  decade: NormalizedDecade;
  dimension: DimensionKey;
  relation: "main" | "support" | "triad" | "weak_related";
  rules: LifeScriptRules;
  mainPalaceKey: NormalizedPalace["palace_key"];
  supportPalaceKeys: Set<NormalizedPalace["palace_key"]>;
}) {
  const dimensionRule = params.rules.dimension_weights[params.dimension];

  const majorStarDetails: MajorStarContributionTrace[] = params.palace.major_stars.map((star) => {
    const base = scoreBase(star.name_key, params.dimension, params.rules.star_base_scores);
    const stateCoeff = scoreStateCoeff(star.state_key, params.rules);
    const affinityCoeff = scorePalaceAffinity(
      star.name_key,
      params.palace.palace_key,
      params.rules
    );
    const finalContribution = base * stateCoeff * affinityCoeff;
    return {
      raw: star.raw,
      star_zh: star.name_zh,
      star_key: star.name_key,
      state_zh: star.state_zh,
      state_key: star.state_key,
      dimension_base_score: base,
      state_coeff: stateCoeff,
      palace_affinity_coeff: affinityCoeff,
      final_contribution: round(finalContribution),
      explanation: `主星先按“基础分 ${base} × 状态系数 ${stateCoeff} × 宫位适配系数 ${affinityCoeff}”得到 ${round(finalContribution)} 分，再参与主星模块平均。`,
    };
  });

  const majorStarAverage =
    majorStarDetails.length > 0
      ? majorStarDetails.reduce((sum, item) => sum + item.final_contribution, 0) /
        majorStarDetails.length
      : 0;
  const majorStarMergeCoeff =
    majorStarDetails.length > 0 ? 1 + 0.1 * (majorStarDetails.length - 1) : 0;
  const major_star_total_before_cap = majorStarAverage * majorStarMergeCoeff;
  const major_star_total_after_cap = capPositiveOnly(
    major_star_total_before_cap,
    dimensionRule.module_caps.major_star
  );

  const allSideStars = [...params.palace.helper_stars, ...params.palace.malefic_stars];
  const sideStarDetails: SideStarContributionTrace[] = allSideStars.map((star) => {
    const helperBase = scoreBase(star.name_key, params.dimension, params.rules.helper_stars);
    const maleficBase = scoreBase(star.name_key, params.dimension, params.rules.malefic_stars);
    const base = helperBase !== 0 ? helperBase : maleficBase;
    const stateCoeff = scoreStateCoeff(star.state_key, params.rules);
    const affinityCoeff = scorePalaceAffinity(
      star.name_key,
      params.palace.palace_key,
      params.rules
    );
    const finalContribution = base * stateCoeff * affinityCoeff;
    return {
      raw: star.raw,
      star_zh: star.name_zh,
      star_key: star.name_key,
      state_zh: star.state_zh,
      state_key: star.state_key,
      dimension_base_score: base,
      state_coeff: stateCoeff,
      palace_affinity_coeff: affinityCoeff,
      final_contribution: round(finalContribution),
      explanation: `辅星模块按“基础分 ${base} × 状态系数 ${stateCoeff} × 宫位适配系数 ${affinityCoeff}”累计，当前这颗星贡献 ${round(finalContribution)} 分。`,
    };
  });
  const side_star_total_before_cap = sideStarDetails.reduce(
    (sum, item) => sum + item.final_contribution,
    0
  );
  const side_star_total_after_cap = capPositiveOnly(
    side_star_total_before_cap,
    dimensionRule.module_caps.side_star
  );

  let small_star_adjustment = 0;
  const smallStarDetails: MiscGodContributionTrace[] = [];
  for (const tag of params.palace.other_tags) {
    const adjustment = params.rules.misc_gods[tag]?.[params.dimension] ?? 0;
    if (adjustment === 0) continue;
    small_star_adjustment += adjustment;
    smallStarDetails.push({
      god: tag,
      adjustment,
      explanation: `小星/杂曜 ${tag} 命中静态修正表，对当前维度贡献 ${adjustment} 分。`,
    });
  }

  const changsheng_adjustment = params.palace.changsheng_phase
    ? params.rules.changsheng[params.palace.changsheng_phase] ?? 0
    : 0;
  const changshengDetail: ChangshengTrace = {
    changsheng_phase: params.palace.changsheng_phase,
    adjustment: changsheng_adjustment,
    explanation: params.palace.changsheng_phase
      ? `十二长生阶段是 ${params.palace.changsheng_phase}，按新规则对静态修正模块贡献 ${changsheng_adjustment} 分。`
      : "当前宫位没有可用十二长生信息，因此长生修正按 0 分处理。",
  };

  let shensha_adjustment = 0;
  const shenshaDetails: MiscGodContributionTrace[] = [];
  for (const god of params.palace.shensha) {
    const adjustment = params.rules.misc_gods[god]?.[params.dimension] ?? 0;
    if (adjustment === 0) continue;
    shensha_adjustment += adjustment;
    shenshaDetails.push({
      god,
      adjustment,
      explanation: `神煞 ${god} 命中神煞修正表，对当前维度贡献 ${adjustment} 分。`,
    });
  }

  const static_adjustment_before_cap =
    small_star_adjustment + changsheng_adjustment + shensha_adjustment;
  const static_adjustment_after_cap = clampBetween(
    static_adjustment_before_cap,
    params.rules.static_adjustment.min,
    params.rules.static_adjustment.max
  );

  const natalTransformationDetails: TransformationContributionTrace[] = [];
  let natal_transformation_adjustment = 0;
  for (const star of [...params.palace.major_stars, ...params.palace.helper_stars, ...params.palace.malefic_stars]) {
    for (const transformation of star.natal_transformations) {
      const base =
        transformation.effect_key != null
          ? params.rules.transformations.natal_scores[transformation.effect_key] ?? 0
          : 0;
      natal_transformation_adjustment += base;
      natalTransformationDetails.push({
        transformation_type: "natal",
        raw: transformation.tag,
        star_zh: star.name_zh,
        star_key: star.name_key,
        effect_zh: transformation.effect_zh,
        effect_key: transformation.effect_key,
        hit_current_palace: true,
        base_score: base,
        actual_contribution: round(base),
        explanation:
          transformation.effect_key != null
            ? `生年四化标签 ${transformation.tag} 已经明确挂在当前宫位星曜上，因此按固定值 ${base} 分直接计入。`
            : `生年四化标签 ${transformation.tag} 无法识别成禄权科忌，因此这条按 0 分处理。`,
      });
    }
  }

  const palaceStarKeys = new Set(
    [...params.palace.major_stars, ...params.palace.helper_stars, ...params.palace.malefic_stars]
      .map((star) => star.name_key)
      .filter((value): value is string => Boolean(value))
  );
  const decadeTransformationDetails: TransformationContributionTrace[] = [];
  let decade_transformation_adjustment = 0;
  for (const transformation of params.decade.transformations) {
    const hitCurrentPalace = Boolean(
      transformation.star_key && palaceStarKeys.has(transformation.star_key)
    );
    const base =
      transformation.effect_key != null
        ? params.rules.transformations.decade_scores[transformation.effect_key] ?? 0
        : 0;
    const actualContribution = hitCurrentPalace ? base : 0;
    decade_transformation_adjustment += actualContribution;
    decadeTransformationDetails.push({
      transformation_type: "decade",
      raw: transformation.raw,
      star_zh: transformation.star_zh,
      star_key: transformation.star_key,
      effect_zh: transformation.effect_zh,
      effect_key: transformation.effect_key,
      hit_current_palace: hitCurrentPalace,
      base_score: base,
      actual_contribution: round(actualContribution),
      explanation: hitCurrentPalace
        ? `大限四化 ${transformation.raw} 命中了当前宫位中的星曜，因此按固定值 ${base} 分直接计入。`
        : `大限四化 ${transformation.raw} 没有命中当前宫位的星曜，因此这一宫按 0 分处理。`,
    });
  }

  const total =
    major_star_total_after_cap +
    side_star_total_after_cap +
    static_adjustment_after_cap +
    natal_transformation_adjustment +
    decade_transformation_adjustment;

  const breakdown: PalaceContributionBreakdown = {
    major_star_total_before_cap: round(major_star_total_before_cap),
    major_star_total_after_cap: round(major_star_total_after_cap),
    side_star_total_before_cap: round(side_star_total_before_cap),
    side_star_total_after_cap: round(side_star_total_after_cap),
    small_star_adjustment: round(small_star_adjustment),
    changsheng_adjustment,
    shensha_adjustment: round(shensha_adjustment),
    static_adjustment_before_cap: round(static_adjustment_before_cap),
    static_adjustment_after_cap: round(static_adjustment_after_cap),
    natal_transformation_adjustment: round(natal_transformation_adjustment),
    decade_transformation_adjustment: round(decade_transformation_adjustment),
    total: round(total),
  };

  const debug: PalaceScoreDebug = {
    palace_index: params.palace.index,
    palace_key: params.palace.palace_key,
    palace_zh_name: params.palace.name_zh,
    relation: params.relation,
    ji_transformation_count: countJiTransformationsForPalace(
      params.palace,
      params.decade.transformations
    ),
    palace_score_total: breakdown.total,
    breakdown,
    major_star_details: majorStarDetails,
    side_star_details: sideStarDetails,
    small_star_details: smallStarDetails,
    changsheng_detail: changshengDetail,
    shensha_details: shenshaDetails,
    transformation_details: [
      ...natalTransformationDetails,
      ...decadeTransformationDetails,
    ],
    explanation_lines: [
      `${DIMENSION_KEY_TO_ZH[params.dimension]}维度读取的是「${params.palace.name_zh}」这座静态宫，它在当前 decade 中属于 ${params.relation} 关系。`,
      `主星模块先逐颗计算，再做“平均 × 多主星合并系数”，得到 ${breakdown.major_star_total_before_cap} 分；该维度主星模块上限是 ${dimensionRule.module_caps.major_star}，截顶后记 ${breakdown.major_star_total_after_cap} 分。`,
      `辅星模块把吉辅与煞曜统一按“基础分 × 状态系数 × 宫位适配”累计，得到 ${breakdown.side_star_total_before_cap} 分；该维度辅星模块上限是 ${dimensionRule.module_caps.side_star}，截顶后记 ${breakdown.side_star_total_after_cap} 分。`,
      `静态修正模块 = 小星/杂曜 ${breakdown.small_star_adjustment} + 十二长生 ${breakdown.changsheng_adjustment} + 神煞 ${breakdown.shensha_adjustment} = ${breakdown.static_adjustment_before_cap} 分，再按固定范围 ${params.rules.static_adjustment.min}~${params.rules.static_adjustment.max} 截断到 ${breakdown.static_adjustment_after_cap} 分。`,
      `生年四化修正 ${breakdown.natal_transformation_adjustment} 分，大限四化修正 ${breakdown.decade_transformation_adjustment} 分；这两项都只在“命中当前宫位”时按固定值生效。`,
      `所以 ${PALACE_KEY_TO_ZH[params.palace.palace_key]} 这座宫最终给 ${DIMENSION_KEY_TO_ZH[params.dimension]}维度贡献 ${breakdown.total} 分。`,
    ],
  };

  return {
    score: breakdown.total,
    debug,
    description: `${DIMENSION_KEY_TO_ZH[params.dimension]}:${params.palace.name_zh}`,
  };
}
