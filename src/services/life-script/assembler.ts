import { DIMENSION_KEY_ORDER, DIMENSION_KEY_TO_ZH } from "./constants";
import type { DimensionKey } from "./constants";
import { buildLifeScriptDebugMarkdown } from "./debug-markdown";
import type {
  DecadeResult,
  DebugTrace,
  LifeScriptFacts,
  LifeScriptRankingPoint,
  LifeScriptResult,
  LifeScriptRules,
  LifeScriptScorePoint,
  PreviewSummary,
  TimeAxisPoint,
} from "./types";

function buildTimeAxis(results: DecadeResult[]): TimeAxisPoint[] {
  return results.map(({ decade }) => ({
    decade_index: decade.decade_index,
    start_age: decade.start_age,
    end_age: decade.end_age,
    label: decade.label,
    target_year: decade.target_year,
  }));
}

function buildScoreSeries(results: DecadeResult[], dimension: DimensionKey): LifeScriptScorePoint[] {
  return results.map(({ decade, scores }) => ({
    decade_index: decade.decade_index,
    start_age: decade.start_age,
    end_age: decade.end_age,
    label: decade.label,
    value: scores[dimension],
  }));
}

function buildDimensionBriefs(params: {
  scores: Record<DimensionKey, LifeScriptScorePoint[]>;
  rules: LifeScriptRules;
}) {
  return Object.fromEntries(
    DIMENSION_KEY_ORDER.map((dimension) => {
      const values = params.scores[dimension].map((item) => item.value);
      const peak = Math.max(...values);
      const avg =
        values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
      const bucket = peak >= 75 ? "high" : avg >= 50 ? "middle" : "low";
      const template = params.rules.summary_templates.dimension_brief_templates[bucket];
      return [
        dimension,
        template.replace("{dimension_zh}", DIMENSION_KEY_TO_ZH[dimension]),
      ];
    })
  ) as Record<DimensionKey, string>;
}

/**
 * 组装最终输出。
 *
 * 这里把“给前端/落盘的结果结构”集中定义，避免业务逻辑各自拼 JSON。
 * 特别是 llm_facts 明确只作为“扩写事实底座”，不是让大模型重新计算命盘。
 */
export function assembleLifeScriptResult(params: {
  decadeResults: DecadeResult[];
  rankings: Record<DimensionKey, LifeScriptRankingPoint[]>;
  previewSummary: PreviewSummary;
  rules: LifeScriptRules;
  normalizationWarnings: string[];
  fallbacks: string[];
  debugTrace?: DebugTrace;
}): LifeScriptResult {
  const time_axis = buildTimeAxis(params.decadeResults);

  const scores = Object.fromEntries(
    DIMENSION_KEY_ORDER.map((dimension) => [
      dimension,
      buildScoreSeries(params.decadeResults, dimension),
    ])
  ) as Record<DimensionKey, LifeScriptScorePoint[]>;

  const llm_facts: LifeScriptFacts = {
    time_axis,
    scores,
    rankings: params.rankings,
    peak_periods: params.previewSummary.peak_periods,
    low_periods: params.previewSummary.low_periods,
    current_period: params.previewSummary.current_period_tip.current_period,
    pattern_type: params.previewSummary.overall_pattern.type,
    dimension_briefs: buildDimensionBriefs({
      scores,
      rules: params.rules,
    }),
  };

  const result: LifeScriptResult = {
    scores,
    rankings: params.rankings,
    time_axis,
    preview_summary: params.previewSummary,
    llm_facts,
  };

  if (params.debugTrace) {
    result.debug_trace = params.debugTrace;
    result.debug_markdown = buildLifeScriptDebugMarkdown(params.debugTrace);
  }

  return result;
}
