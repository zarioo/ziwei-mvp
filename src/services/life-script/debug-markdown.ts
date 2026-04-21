import { DIMENSION_KEY_ORDER, DIMENSION_KEY_TO_ZH, PALACE_KEY_TO_ZH } from "./constants";
import type { DebugTrace } from "./types";

/**
 * 生成人工核对友好的 Markdown 调试报告。
 *
 * 这个输出不是给程序消费的，而是给人快速审计用的。
 * 因此它会优先保证可读性，把关键结论和关键数字都展开成自然语言，
 * 方便产品或规则维护者不打开源码也能跟着分数往回追。
 */
export function buildLifeScriptDebugMarkdown(trace: DebugTrace) {
  const lines: string[] = [];

  lines.push("# 人生剧本评分调试报告");
  lines.push("");
  lines.push("## 输入摘要");
  lines.push(`- 身宫索引：${trace.input_snapshot.body_palace_index ?? "无"}`);
  lines.push(`- 时间轴来源：${trace.input_snapshot.time_axis_source}`);
  lines.push(`- 静态宫数量：${trace.input_snapshot.normalized_summary.static_palace_count}`);
  lines.push(`- decade 数量：${trace.input_snapshot.normalized_summary.decade_count}`);
  if (trace.normalization_warnings.length > 0) {
    lines.push(`- normalize 警告：${trace.normalization_warnings.join("；")}`);
  }
  if (trace.natal_transformation_parse_notes.length > 0) {
    lines.push(
      `- 生年四化解析提示：${trace.natal_transformation_parse_notes.join("；")}`
    );
  }
  if (trace.fallbacks.length > 0) {
    lines.push(`- fallback：${trace.fallbacks.join("；")}`);
  }
  lines.push("");
  lines.push("## 摘要生成依据");
  lines.push(`- total_luck 分数：${trace.summary_trace.total_luck_scores.join("、")}`);
  lines.push(`- pattern：${trace.summary_trace.pattern_reason}`);
  lines.push(`- top_dimensions：${trace.summary_trace.top_dimensions_reason}`);
  lines.push(`- peak_periods：${trace.summary_trace.peak_periods_reason}`);
  lines.push(`- low_periods：${trace.summary_trace.low_periods_reason}`);
  lines.push(`- current_period_tip：${trace.summary_trace.current_period_reason}`);

  for (const decade of trace.per_decade) {
    lines.push("");
    lines.push(`## ${decade.decade_label}`);
    lines.push(`- 年龄范围：${decade.start_age ?? "无"}~${decade.end_age ?? "无"}`);
    lines.push(
      `- 映射：${Object.entries(decade.mapping)
        .map(([key, value]) => `${PALACE_KEY_TO_ZH[key as keyof typeof PALACE_KEY_TO_ZH]}=${value ?? "无"}`)
        .join("；")}`
    );

    for (const dimension of DIMENSION_KEY_ORDER) {
      const debug = decade.dimensions[dimension];
      lines.push("");
      lines.push(`### ${DIMENSION_KEY_TO_ZH[dimension]}`);
      lines.push(`- ${debug.explanation_summary}`);
      lines.push(`- 主宫：${PALACE_KEY_TO_ZH[debug.main_palace.palace_key]} -> ${debug.main_palace.static_index ?? "无"}`);
      lines.push(
        `- 辅宫：${
          debug.support_palaces.length > 0
            ? debug.support_palaces
                .map((item) => `${PALACE_KEY_TO_ZH[item.palace_key]} -> ${item.static_index ?? "无"}`)
                .join("；")
            : "无"
        }`
      );
      lines.push(
        `- triad：reference=${PALACE_KEY_TO_ZH[debug.triad.triad_reference_palace_key]}，indices=${debug.triad.triad_indices.join("、") || "无"}，average=${debug.triad.average_score}，weighted=${debug.triad.weighted_contribution}`
      );
      lines.push(
        `- 加权贡献：main=${debug.weighted_contributions.main}，support=${debug.weighted_contributions.support}，triad=${debug.weighted_contributions.triad}，body=${debug.weighted_contributions.body}`
      );
      lines.push(
        `- 维度原始分=${debug.raw_weighted_score}，风险修正=${debug.risk_adjustment.applied_score}，风险后 raw=${debug.raw_score_after_risk}`
      );
      lines.push(
        `- 归一化：raw区间=${debug.normalization.raw_min}~${debug.normalization.raw_max}，比例=${debug.normalization.ratio}，展示分=${debug.normalization.normalized_score}，最终分=${debug.normalization.clamped_score}`
      );

      for (const step of debug.explanation_steps) {
        lines.push(`- ${step}`);
      }

      for (const palace of debug.palace_details) {
        lines.push(
          `- 宫位 ${palace.palace_zh_name}(${palace.relation})：总分 ${palace.palace_score_total}，主星模块 ${palace.breakdown.major_star_total_after_cap}，辅星模块 ${palace.breakdown.side_star_total_after_cap}，静态修正 ${palace.breakdown.static_adjustment_after_cap}，生年四化 ${palace.breakdown.natal_transformation_adjustment}，大限四化 ${palace.breakdown.decade_transformation_adjustment}`
        );
        for (const line of palace.explanation_lines) {
          lines.push(`  - ${line}`);
        }
      }
    }
  }

  lines.push("");
  lines.push("## 排名过程");
  for (const dimension of DIMENSION_KEY_ORDER) {
    const traceEntry = trace.rankings_trace.per_dimension[dimension];
    lines.push(`### ${DIMENSION_KEY_TO_ZH[dimension]}`);
    lines.push(
      `- 原始列表：${traceEntry.raw_scores
        .map((item) => `${item.label}:${item.score}`)
        .join("；")}`
    );
    lines.push(
      `- 排序结果：${traceEntry.sorted_scores
        .map((item) => `${item.rank}.${item.label}=${item.score} (${item.tie_break_reason})`)
        .join("；")}`
    );
  }

  return lines.join("\n");
}
