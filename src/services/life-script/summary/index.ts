import { DIMENSION_KEY_ORDER, DIMENSION_KEY_TO_ZH } from "../constants";
import type { DimensionKey } from "../constants";
import type {
  LifeScriptRules,
  PreviewSummary,
  SummaryTrace,
  TimeAxisPoint,
} from "../types";

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function classifyPattern(scores: number[]) {
  if (scores.length === 0) return "stable";

  const firstThird = scores.slice(0, 3);
  const middleThird = scores.slice(3, 6);
  const lastThird = scores.slice(6);
  const firstAvg = average(firstThird);
  const middleAvg = average(middleThird);
  const lastAvg = average(lastThird);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const variance = maxScore - minScore;
  const peakIndex = scores.indexOf(maxScore);

  if (variance <= 10) return "stable";
  if (lastAvg - firstAvg >= 12) return "rising_late";
  if (firstAvg >= 72 && Math.abs(firstAvg - lastAvg) <= 8) return "high_and_stable";
  if (peakIndex >= 3 && peakIndex <= 5) return "midlife_peak";
  if (lastAvg >= middleAvg + 8 && lastAvg >= firstAvg + 8) return "late_rise";
  return "volatile";
}

function findExtremaPeriods(params: {
  scores: number[];
  timeAxis: TimeAxisPoint[];
  mode: "peak" | "low";
}) {
  if (params.scores.length === 0) return [];
  const targetValue =
    params.mode === "peak"
      ? Math.max(...params.scores)
      : Math.min(...params.scores);
  return params.timeAxis.filter(
    (_, index) => (params.scores[index] ?? 0) === targetValue
  );
}

function resolveCurrentAge(timeAxis: TimeAxisPoint[]) {
  const currentYear = new Date().getFullYear();
  for (const point of timeAxis) {
    if (typeof point.target_year !== "number" || typeof point.start_age !== "number") {
      continue;
    }
    return currentYear - (point.target_year - point.start_age);
  }
  return null;
}

function resolveCurrentPeriod(timeAxis: TimeAxisPoint[], currentAge: number | null) {
  if (currentAge == null) return null;
  return (
    timeAxis.find((point) => {
      if (typeof point.start_age !== "number" || typeof point.end_age !== "number") {
        return false;
      }
      return currentAge >= point.start_age && currentAge <= point.end_age;
    }) ?? null
  );
}

function buildCurrentPeriodMessage(params: {
  totalLuckScores: number[];
  timeAxis: TimeAxisPoint[];
  currentPeriod: TimeAxisPoint | null;
  rules: LifeScriptRules;
}) {
  if (!params.currentPeriod) {
    return "当前年龄未能稳定映射到某个大限，暂时只输出整体趋势。";
  }
  const index = params.currentPeriod.decade_index;
  const score = params.totalLuckScores[index] ?? 0;
  if (score >= 68) {
    return params.rules.summary_templates.current_period_templates.high;
  }
  if (score >= 45) {
    return params.rules.summary_templates.current_period_templates.middle;
  }
  return params.rules.summary_templates.current_period_templates.low;
}

/**
 * 生成付费前摘要。
 *
 * 这部分故意不依赖大模型。
 * 产品上需要它稳定可控，且必须和后端算出来的图一致，所以这里用模板与规则直接产出。
 */
export function buildPreviewSummary(params: {
  scores: Record<DimensionKey, number[]>;
  timeAxis: TimeAxisPoint[];
  rules: LifeScriptRules;
}): {
  summary: PreviewSummary;
  trace: SummaryTrace;
} {
  const totalLuckScores = params.scores.total_luck;
  const patternType = classifyPattern(totalLuckScores);
  const currentAge = resolveCurrentAge(params.timeAxis);
  const currentPeriod = resolveCurrentPeriod(params.timeAxis, currentAge);

  const top_dimensions = DIMENSION_KEY_ORDER.map((dimension) => ({
    dimension,
    dimension_zh: DIMENSION_KEY_TO_ZH[dimension],
    peak_score: Math.max(...(params.scores[dimension] ?? [0])),
  }))
    .sort((a, b) => b.peak_score - a.peak_score)
    .slice(0, 2);

  const summary: PreviewSummary = {
    overall_pattern: {
      type: patternType,
      description:
        params.rules.summary_templates.patterns[patternType] ??
        params.rules.summary_templates.patterns.stable,
    },
    top_dimensions,
    peak_periods: findExtremaPeriods({
      scores: totalLuckScores,
      timeAxis: params.timeAxis,
      mode: "peak",
    }),
    low_periods: findExtremaPeriods({
      scores: totalLuckScores,
      timeAxis: params.timeAxis,
      mode: "low",
    }),
    current_period_tip: {
      current_age: currentAge,
      current_period: currentPeriod,
      message: buildCurrentPeriodMessage({
        totalLuckScores,
        timeAxis: params.timeAxis,
        currentPeriod,
        rules: params.rules,
      }),
    },
  };

  const trace: SummaryTrace = {
    total_luck_scores: totalLuckScores,
    pattern_type: patternType,
    pattern_reason: `total_luck 的 9 段分数是 ${totalLuckScores.join("、")}，因此被判定为 ${patternType}。`,
    top_dimensions_reason: `按各维度峰值排序后，前两位分别是 ${top_dimensions
      .map((item) => `${item.dimension_zh}(${item.peak_score})`)
      .join("、")}。`,
    peak_periods_reason: `peak_periods 取 total_luck 中最高分 ${
      Math.max(...totalLuckScores)
    } 对应的 decade。`,
    low_periods_reason: `low_periods 取 total_luck 中最低分 ${
      Math.min(...totalLuckScores)
    } 对应的 decade。`,
    current_period_reason: currentPeriod
      ? `current_period_tip 根据当前年龄 ${currentAge} 映射到 ${currentPeriod.label} 这段 decade。`
      : "当前年龄无法稳定映射到某一段 decade，因此 current_period_tip 仅输出整体提示。",
  };

  return {
    summary,
    trace,
  };
}
