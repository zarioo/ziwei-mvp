import { DIMENSION_KEY_ORDER } from "./constants";
import type { DimensionKey } from "./constants";
import { loadLifeScriptRules } from "./config/loader";
import { assembleLifeScriptResult } from "./assembler";
import { calculateDimensionScore } from "./engine/dimension-score";
import { buildRankings } from "./engine/ranking";
import { normalizeLifeScriptInput } from "./normalize";
import { buildPreviewSummary } from "./summary";
import type {
  DecadeResult,
  GenerateLifeScriptOptions,
  LifeScriptResult,
  LifeScriptSourceInput,
} from "./types";

/**
 * 人生剧本评分引擎主入口。
 *
 * 输入：上游已经生成好的 canonical fortune JSON
 * 输出：曲线分数、排名、摘要、llm_facts、debug
 *
 * 特别说明：
 * llm_facts 的职责是给后续大模型“扩写”用，
 * 不是给它“重新算命”用，所以这里会把确定性结果全部先算好再输出。
 */
export async function generateLifeScript(
  source: LifeScriptSourceInput,
  options?: GenerateLifeScriptOptions
): Promise<LifeScriptResult> {
  const rules = await loadLifeScriptRules();
  const normalized = normalizeLifeScriptInput(source);
  const fallbacks: string[] = [];

  const decadeResults: DecadeResult[] = normalized.decades.map((decade) => {
    const scores = {} as Record<DimensionKey, number>;
    const debug = {} as DecadeResult["debug"];

    for (const dimension of DIMENSION_KEY_ORDER) {
      const result = calculateDimensionScore({
        input: normalized,
        decade,
        dimension,
        rules,
      });
      scores[dimension] = result.score;
      debug[dimension] = result.debug;

      const hasUnknownMajorStar = normalized.static_palaces.some((palace) =>
        palace.major_stars.some((star) => star.name_zh && !star.name_key)
      );
      if (hasUnknownMajorStar) {
        fallbacks.push("存在未映射主星，已按基础分 0 处理");
      }
    }

    return {
      decade,
      scores,
      debug,
    };
  });

  const timeAxis = decadeResults.map((item) => ({
    decade_index: item.decade.decade_index,
    start_age: item.decade.start_age,
    end_age: item.decade.end_age,
    label: item.decade.label,
    target_year: item.decade.target_year,
  }));

  const rankingTracePerDimension = {} as NonNullable<
    LifeScriptResult["debug_trace"]
  >["rankings_trace"]["per_dimension"];
  const rankings = Object.fromEntries(
    DIMENSION_KEY_ORDER.map((dimension) => {
      const scoreSeries = decadeResults.map((item) => ({
        decade_index: item.decade.decade_index,
        start_age: item.decade.start_age,
        end_age: item.decade.end_age,
        label: item.decade.label,
        value: item.scores[dimension],
      }));
      const mainPalaceScores = decadeResults.map(
        (item) => item.debug[dimension].main_palace_score
      );
      const jiCounts = decadeResults.map((item) =>
        item.debug[dimension].palace_details.reduce(
          (sum, palace) => sum + palace.ji_transformation_count,
          0
        )
      );
      const rankingResult = buildRankings({
        dimension,
        timeAxis,
        scores: scoreSeries,
        mainPalaceScores,
        jiCounts,
      });
      rankingTracePerDimension[dimension] = rankingResult.trace;
      return [
        dimension,
        rankingResult.rankings,
      ];
    })
  ) as LifeScriptResult["rankings"];

  const previewSummaryResult = buildPreviewSummary({
    scores: Object.fromEntries(
      DIMENSION_KEY_ORDER.map((dimension) => [
        dimension,
        decadeResults.map((item) => item.scores[dimension]),
      ])
    ) as Record<DimensionKey, number[]>,
    timeAxis,
    rules,
  });

  return assembleLifeScriptResult({
    decadeResults,
    rankings,
    previewSummary: previewSummaryResult.summary,
    rules,
    normalizationWarnings: normalized.debug.normalization_warnings,
    fallbacks: Array.from(new Set(fallbacks)),
    debugTrace: options?.debug
      ? {
          input_snapshot: {
            metadata: normalized.metadata,
            body_palace_index: normalized.body_palace_index,
            time_axis_source: "selected_time_slices.decades.start_age/end_age",
            normalized_summary: {
              static_palace_count: normalized.static_palaces.length,
              decade_count: normalized.decades.length,
              normalization_warnings: normalized.debug.normalization_warnings,
              natal_transformation_parse_notes:
                normalized.debug.natal_transformation_parse_notes,
            },
          },
          per_decade: decadeResults.map((item) => ({
            decade_label: item.decade.label,
            start_age: item.decade.start_age,
            end_age: item.decade.end_age,
            mapping: item.decade.mapping,
            dimensions: item.debug,
          })),
          rankings_trace: {
            per_dimension: rankingTracePerDimension,
          },
          summary_trace: previewSummaryResult.trace,
          normalization_warnings: normalized.debug.normalization_warnings,
          natal_transformation_parse_notes:
            normalized.debug.natal_transformation_parse_notes,
          fallbacks: Array.from(new Set(fallbacks)),
        }
      : undefined,
  });
}
