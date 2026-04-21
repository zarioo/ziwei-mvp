import { DIMENSION_KEY_TO_ZH, PALACE_KEY_TO_ZH } from "../constants";
import type { DimensionKey, PalaceKey } from "../constants";
import type {
  DimensionScoreDebug,
  LifeScriptRules,
  NormalizedDecade,
  NormalizedLifeScriptInput,
  RiskContributionTrace,
} from "../types";
import { calculateBodyAdjustment } from "./body-adjustment";
import { calculatePalaceScore } from "./palace-score";
import {
  clampScore,
  classifyPalaceRelation,
  getMainPalaceKey,
  getMappedPalace,
  getPalaceByIndex,
  getTriadPalaces,
  normalizeScore,
} from "./utils";

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function buildRiskAdjustment(params: {
  decade: NormalizedDecade;
  dimension: DimensionKey;
  rules: LifeScriptRules;
}): RiskContributionTrace {
  const risk = params.decade.risk_alert;
  const conflictPalaceKey = risk?.conflict_palace_key ?? null;
  const appliedScore = conflictPalaceKey
    ? params.rules.risk_alert.conflict_scores[conflictPalaceKey]?.[params.dimension] ?? 0
    : 0;

  return {
    raw: risk?.raw ?? null,
    parsed: risk ?? null,
    conflict_palace_key: conflictPalaceKey,
    conflict_palace_zh: risk?.conflict_palace_zh ?? null,
    applied_score: appliedScore,
    explanation: risk
      ? conflictPalaceKey
        ? `风险提示读取“冲本命${risk.conflict_palace_zh ?? PALACE_KEY_TO_ZH[conflictPalaceKey as PalaceKey]}”，在${DIMENSION_KEY_TO_ZH[params.dimension]}维度按风险查表修正 ${appliedScore} 分。`
        : "风险提示存在，但没能解析出被冲宫位，因此这一维度风险修正按 0 分处理。"
      : "当前 decade 没有 risk_alert，因此维度层风险修正按 0 分处理。",
  };
}

/**
 * 计算某个 decade 在某个维度上的最终分。
 *
 * 这里专门负责“维度拼装”：
 * 1. 找主宫 / 辅宫 / 三方
 * 2. 读取各自宫位综合分
 * 3. 套用权重
 * 4. 做身宫细调
 * 5. 再统一 normalize 和 clamp
 *
 * 这样可以保证“宫位怎么得分”和“维度怎么汇总”是两层独立规则，
 * 后续如果产品只想调权重，不需要碰 palace_score 的内部实现。
 */
export function calculateDimensionScore(params: {
  input: NormalizedLifeScriptInput;
  decade: NormalizedDecade;
  dimension: DimensionKey;
  rules: LifeScriptRules;
}) {
  const rule = params.rules.dimension_weights[params.dimension];
  const mainPalaceKey = getMainPalaceKey(rule);
  const mainPalace = getMappedPalace(params.input, params.decade, mainPalaceKey);
  const supportPalaceMappings = Object.keys(rule.support)
    .map((key) => ({
      slot_key: key as keyof typeof rule.support,
      palace: getMappedPalace(
        params.input,
        params.decade,
        key as keyof typeof rule.support
      ),
    }))
    .filter(
      (
        item
      ): item is {
        slot_key: keyof typeof rule.support;
        palace: NonNullable<ReturnType<typeof getMappedPalace>>;
      } => Boolean(item.palace)
    );
  const supportPalaces = supportPalaceMappings.map((item) => item.palace);
  const triadReferencePalace = getMappedPalace(
    params.input,
    params.decade,
    rule.triad_reference
  );
  const triadPalaces = getTriadPalaces(params.input, triadReferencePalace);
  const supportPalaceKeys = new Set(supportPalaces.map((item) => item.palace_key));

  const palaceDetails = [];

  const mainPalaceResult = mainPalace
    ? calculatePalaceScore({
        input: params.input,
        palace: mainPalace,
        decade: params.decade,
        dimension: params.dimension,
        relation: "main",
        rules: params.rules,
        mainPalaceKey,
        supportPalaceKeys,
      })
    : { score: 0, debug: null };

  if (mainPalaceResult.debug) {
    palaceDetails.push(mainPalaceResult.debug);
  }

  const supportPalaceScores = supportPalaceMappings.map(({ slot_key, palace }) => {
    const result = calculatePalaceScore({
      input: params.input,
      palace,
      decade: params.decade,
      dimension: params.dimension,
      relation: "support",
      rules: params.rules,
      mainPalaceKey,
      supportPalaceKeys,
    });
    palaceDetails.push(result.debug);
    return {
      palace_key: slot_key,
      weight: rule.support[slot_key] ?? 0,
      score: result.score,
    };
  });

  const triadPalaceScores = triadPalaces.map((palace) => {
    const result = calculatePalaceScore({
      input: params.input,
      palace,
      decade: params.decade,
      dimension: params.dimension,
      relation: classifyPalaceRelation(palace, mainPalace, supportPalaces, triadPalaces),
      rules: params.rules,
      mainPalaceKey,
      supportPalaceKeys,
    });
    palaceDetails.push(result.debug);
    return {
      palace_index: palace.index,
      score: result.score,
    };
  });

  const bodyPalace = getPalaceByIndex(params.input, params.input.body_palace_index);
  const bodyPalaceRawScore = bodyPalace
    ? calculatePalaceScore({
        input: params.input,
        palace: bodyPalace,
        decade: params.decade,
        dimension: params.dimension,
        relation: classifyPalaceRelation(bodyPalace, mainPalace, supportPalaces, triadPalaces),
        rules: params.rules,
        mainPalaceKey,
        supportPalaceKeys,
      }).score
    : 0;

  const bodyAdjustment = calculateBodyAdjustment({
    input: params.input,
    decade: params.decade,
    rule,
    rules: params.rules,
    bodyPalaceRawScore,
    mainPalace,
    supportPalaces,
    triadPalaces,
  });

  const raw_weighted_score =
    mainPalaceResult.score * (rule.main[mainPalaceKey] ?? 0) +
    supportPalaceScores.reduce(
      (sum, item) => sum + item.score * item.weight,
      0
    ) +
    (triadPalaceScores.length > 0
      ? (triadPalaceScores.reduce((sum, item) => sum + item.score, 0) /
          triadPalaceScores.length) *
        rule.triad_weight
      : 0) +
    bodyAdjustment.score * rule.body_weight;

  const riskAdjustment = buildRiskAdjustment({
    decade: params.decade,
    dimension: params.dimension,
    rules: params.rules,
  });
  const raw_score_after_risk = raw_weighted_score + riskAdjustment.applied_score;
  const ratio = normalizeScore(
    raw_score_after_risk,
    rule.normalization.min_raw,
    rule.normalization.max_raw
  );
  const normalized_score =
    params.rules.normalization.display_min +
    ratio *
      (params.rules.normalization.display_max - params.rules.normalization.display_min);
  const clamped_score = clampScore(normalized_score);
  const triadAverage =
    triadPalaceScores.length > 0
      ? triadPalaceScores.reduce((sum, item) => sum + item.score, 0) /
        triadPalaceScores.length
      : 0;
  const mainWeightedContribution =
    mainPalaceResult.score * (rule.main[mainPalaceKey] ?? 0);
  const supportWeightedContribution = supportPalaceScores.reduce(
    (sum, item) => sum + item.score * item.weight,
    0
  );
  const triadWeightedContribution = triadAverage * rule.triad_weight;
  const bodyWeightedContribution = bodyAdjustment.score * rule.body_weight;

  const debug: DimensionScoreDebug = {
    dimension: params.dimension,
    weights: {
      main: rule.main,
      support: rule.support,
      triad_reference: rule.triad_reference,
      triad_weight: rule.triad_weight,
      body_weight: rule.body_weight,
    },
    main_palace: {
      palace_key: mainPalaceKey,
      static_index: mainPalace?.index ?? null,
    },
    support_palaces: Object.keys(rule.support).map((key) => ({
      palace_key: key as keyof typeof rule.support,
      static_index:
        getMappedPalace(params.input, params.decade, key as keyof typeof rule.support)?.index ??
        null,
    })),
    triad: {
      triad_reference_palace_key: rule.triad_reference,
      triad_reference_static_index: triadReferencePalace?.index ?? null,
      relationships: triadReferencePalace
        ? {
            opposite_index: triadReferencePalace.relationships.opposite_index,
            wealth_trine_index: triadReferencePalace.relationships.wealth_trine_index,
            career_trine_index: triadReferencePalace.relationships.career_trine_index,
          }
        : null,
      triad_indices: triadPalaces.map((item) => item.index),
      palace_scores: triadPalaceScores,
      average_score: round(triadAverage),
      triad_weight: rule.triad_weight,
      weighted_contribution: round(triadWeightedContribution),
    },
    raw_weighted_score: round(raw_weighted_score),
    risk_adjustment: riskAdjustment,
    raw_score_after_risk: round(raw_score_after_risk),
    normalization: {
      raw_min: rule.normalization.min_raw,
      raw_max: rule.normalization.max_raw,
      ratio: round(ratio),
      display_min: params.rules.normalization.display_min,
      display_max: params.rules.normalization.display_max,
      normalized_score: round(normalized_score),
      clamped_score,
    },
    main_palace_score: round(mainPalaceResult.score),
    support_palace_scores: supportPalaceScores,
    triad_palace_scores: triadPalaceScores,
    body_adjustment: bodyAdjustment,
    weighted_contributions: {
      main: round(mainWeightedContribution),
      support: round(supportWeightedContribution),
      triad: round(triadWeightedContribution),
      body: round(bodyWeightedContribution),
    },
    palace_details: palaceDetails,
    explanation_summary: `${DIMENSION_KEY_TO_ZH[params.dimension]}维度以${PALACE_KEY_TO_ZH[mainPalaceKey]}为主轴，在当前 decade 的最终分是 ${clamped_score} 分。`,
    explanation_steps: [
      `主宫 ${PALACE_KEY_TO_ZH[mainPalaceKey]} 先算出单宫原始分 ${round(mainPalaceResult.score)}，它是这个维度最核心的来源。`,
      supportPalaceScores.length > 0
        ? `辅宫共同参与：${supportPalaceScores
            .map(
              (item) =>
                `${PALACE_KEY_TO_ZH[item.palace_key]} × 权重 ${item.weight} × 单宫原始分 ${round(item.score)}`
            )
            .join("；")}。`
        : "这个维度当前没有命中可用辅宫，因此辅宫部分按 0 处理。",
      triadPalaceScores.length > 0
        ? `triad_reference 是 ${PALACE_KEY_TO_ZH[rule.triad_reference]}，实际映射到静态宫 ${triadReferencePalace?.index ?? "无"}，relationships 给出 triad 索引 ${triadPalaces.map((item) => item.index).join("、")}，三方四正平均单宫分 ${round(triadAverage)}，再乘 triad_weight=${rule.triad_weight}。`
        : "三方四正本 decade 没有可用参考宫，因此 triad 部分按 0 处理。",
      `身宫细调为 ${round(bodyAdjustment.score)}，关系类型是 ${bodyAdjustment.relation}，再乘 body_weight=${rule.body_weight} 做轻量修正。`,
      `以上加权贡献分别是：main ${round(mainWeightedContribution)}、support ${round(supportWeightedContribution)}、triad ${round(triadWeightedContribution)}、body ${round(bodyWeightedContribution)}，先得到维度原始分 ${round(raw_weighted_score)}。`,
      `${riskAdjustment.explanation}`,
      `加入风险修正后，维度最终 raw = ${round(raw_weighted_score)} + ${riskAdjustment.applied_score} = ${round(raw_score_after_risk)}。`,
      `再按该维度 raw 区间 ${rule.normalization.min_raw}~${rule.normalization.max_raw} 计算比例 ${round(ratio)}，换算成展示分 ${round(normalized_score)}。`,
      `最后 clamp 到 ${params.rules.normalization.display_min}~${params.rules.normalization.display_max}，得到稳定可展示的最终分 ${clamped_score}。`,
    ],
  };

  return {
    score: clamped_score,
    debug,
  };
}
