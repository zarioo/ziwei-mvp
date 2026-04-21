import type { DimensionKey } from "../constants";
import type {
  LifeScriptRankingPoint,
  RankingTrace,
  LifeScriptScorePoint,
  TimeAxisPoint,
} from "../types";

/**
 * 生成排名。
 *
 * 排名规则严格遵循需求：
 * 1. 分数高者优先
 * 2. 并列时主宫得分更高者优先
 * 3. 再并列时化忌更少者优先
 * 4. 还并列时按时间顺序
 */
export function buildRankings(params: {
  dimension: DimensionKey;
  timeAxis: TimeAxisPoint[];
  scores: LifeScriptScorePoint[];
  mainPalaceScores: number[];
  jiCounts: number[];
}): {
  rankings: LifeScriptRankingPoint[];
  trace: RankingTrace["per_dimension"][DimensionKey];
} {
  const decorated = params.scores.map((item, index) => ({
    ...item,
    time_index: index,
    main_palace_score: params.mainPalaceScores[index] ?? 0,
    ji_count: params.jiCounts[index] ?? 0,
  }));

  const sorted = [...decorated].sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    if (b.main_palace_score !== a.main_palace_score) {
      return b.main_palace_score - a.main_palace_score;
    }
    if (a.ji_count !== b.ji_count) return a.ji_count - b.ji_count;
    return a.time_index - b.time_index;
  });

  const rankByDecadeIndex = new Map<number, number>();
  sorted.forEach((item, index) => {
    rankByDecadeIndex.set(item.decade_index, index + 1);
  });

  const rankings = params.timeAxis.map((point, index) => ({
    decade_index: point.decade_index,
    start_age: point.start_age,
    end_age: point.end_age,
    label: point.label,
    rank: rankByDecadeIndex.get(point.decade_index) ?? index + 1,
    score: params.scores[index]?.value ?? 0,
  }));

  return {
    rankings,
    trace: {
      raw_scores: decorated.map((item) => ({
        decade_index: item.decade_index,
        label: item.label,
        score: item.value,
        main_palace_score: item.main_palace_score,
        ji_count: item.ji_count,
      })),
      sorted_scores: sorted.map((item, index) => ({
        decade_index: item.decade_index,
        label: item.label,
        score: item.value,
        main_palace_score: item.main_palace_score,
        ji_count: item.ji_count,
        rank: index + 1,
        tie_break_reason:
          index === 0
            ? "首位项直接按总分最高确定"
            : item.value !== sorted[index - 1]?.value
              ? "按最终分高低排序"
              : item.main_palace_score !== sorted[index - 1]?.main_palace_score
                ? "并列时按主宫得分更高者优先"
                : item.ji_count !== sorted[index - 1]?.ji_count
                  ? "主宫仍并列时按化忌更少者优先"
                  : "前几项仍并列，最终按时间顺序确定",
      })),
    },
  };
}
