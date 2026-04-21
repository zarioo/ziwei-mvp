import assert from "node:assert/strict";
import test from "node:test";
import { createNormalizedInputForTests, createTestRules } from "../test-helpers";
import { calculateDimensionScore } from "./dimension-score";
import { calculatePalaceScore } from "./palace-score";
import { buildRankings } from "./ranking";

test("主星模块遵循平均后乘多主星系数", () => {
  const input = createNormalizedInputForTests();
  const rules = createTestRules();
  const palace = input.static_palaces.find((item) => item.palace_key === "wealth");
  assert.ok(palace);

  palace.major_stars.push({
    raw: "紫微(庙)",
    name_zh: "紫微",
    name_key: "zi_wei",
    state_zh: "庙",
    state_key: "temple",
    tags: [],
    natal_transformations: [],
  });

  const result = calculatePalaceScore({
    input,
    palace,
    decade: input.decades[0],
    dimension: "wealth",
    relation: "main",
    rules,
    mainPalaceKey: "wealth",
    supportPalaceKeys: new Set(),
  });

  assert.equal(result.debug.breakdown.major_star_total_before_cap, 11.55);
  assert.equal(result.debug.breakdown.major_star_total_after_cap, 11.55);
});

test("主星模块正向过高时会按模块上限截顶", () => {
  const input = createNormalizedInputForTests();
  const rules = createTestRules();
  const palace = input.static_palaces.find((item) => item.palace_key === "life");
  assert.ok(palace);

  const result = calculatePalaceScore({
    input,
    palace,
    decade: input.decades[0],
    dimension: "total_luck",
    relation: "main",
    rules,
    mainPalaceKey: "life",
    supportPalaceKeys: new Set(),
  });

  assert.equal(result.debug.breakdown.major_star_total_before_cap, 14.37);
  assert.equal(result.debug.breakdown.major_star_total_after_cap, 14);
});

test("辅星模块统一计算正负辅星", () => {
  const input = createNormalizedInputForTests();
  const rules = createTestRules();
  const palace = input.static_palaces.find((item) => item.palace_key === "career");
  assert.ok(palace);

  palace.helper_stars.push({
    raw: "禄存",
    name_zh: "禄存",
    name_key: "lu_cun",
    state_zh: null,
    state_key: null,
    tags: [],
    natal_transformations: [],
  });

  const result = calculatePalaceScore({
    input,
    palace,
    decade: input.decades[0],
    dimension: "career",
    relation: "main",
    rules,
    mainPalaceKey: "career",
    supportPalaceKeys: new Set(),
  });

  assert.equal(result.debug.breakdown.side_star_total_before_cap, 4.4);
  assert.equal(result.debug.breakdown.side_star_total_after_cap, 4.4);
});

test("辅星模块正向过高时会按模块上限截顶", () => {
  const input = createNormalizedInputForTests();
  const rules = createTestRules();
  const palace = input.static_palaces.find((item) => item.palace_key === "wealth");
  assert.ok(palace);

  const result = calculatePalaceScore({
    input,
    palace,
    decade: input.decades[0],
    dimension: "wealth",
    relation: "main",
    rules,
    mainPalaceKey: "wealth",
    supportPalaceKeys: new Set(),
  });

  assert.equal(result.debug.breakdown.side_star_total_before_cap, 7.2);
  assert.equal(result.debug.breakdown.side_star_total_after_cap, 6);
});

test("静态修正模块会把小星、长生、神煞合并后截在 -5~+5", () => {
  const input = createNormalizedInputForTests();
  const rules = createTestRules();
  const palace = input.static_palaces.find((item) => item.palace_key === "career");
  assert.ok(palace);

  palace.other_tags.push("破碎");
  palace.other_tags.push("破碎");
  palace.other_tags.push("破碎");
  palace.other_tags.push("破碎");
  palace.shensha.push("病符");

  const result = calculatePalaceScore({
    input,
    palace,
    decade: input.decades[0],
    dimension: "health",
    relation: "main",
    rules,
    mainPalaceKey: "career",
    supportPalaceKeys: new Set(),
  });

  assert.equal(result.debug.breakdown.static_adjustment_before_cap, -7);
  assert.equal(result.debug.breakdown.static_adjustment_after_cap, -5);
});

test("生年四化与大限四化会在命中当前宫位时叠加生效", () => {
  const input = createNormalizedInputForTests();
  const rules = createTestRules();
  const palace = input.static_palaces.find((item) => item.palace_key === "wealth");
  assert.ok(palace);

  const result = calculatePalaceScore({
    input,
    palace,
    decade: input.decades[0],
    dimension: "wealth",
    relation: "main",
    rules,
    mainPalaceKey: "wealth",
    supportPalaceKeys: new Set(),
  });

  assert.equal(result.debug.breakdown.natal_transformation_adjustment, 2);
  assert.equal(result.debug.breakdown.decade_transformation_adjustment, -6);
});

test("风险提示只在维度层按冲宫查表修正，不再进入单宫原始分", () => {
  const input = createNormalizedInputForTests();
  const rules = createTestRules();

  const wealthScore = calculateDimensionScore({
    input,
    decade: input.decades[0],
    dimension: "wealth",
    rules,
  });

  assert.equal(wealthScore.debug.risk_adjustment.applied_score, -6);
  assert.equal(wealthScore.debug.raw_score_after_risk, 6.35);
  assert.equal(
    wealthScore.debug.raw_score_after_risk,
    wealthScore.debug.raw_weighted_score + wealthScore.debug.risk_adjustment.applied_score
  );
});

test("展示分按 45~100 的维度归一化输出", () => {
  const input = createNormalizedInputForTests();
  const rules = createTestRules();

  const wealthScore = calculateDimensionScore({
    input,
    decade: input.decades[0],
    dimension: "wealth",
    rules,
  });

  assert.equal(wealthScore.debug.normalization.raw_min, -10);
  assert.equal(wealthScore.debug.normalization.raw_max, 24);
  assert.equal(wealthScore.score, 71.45);
  assert.ok(wealthScore.score >= 45 && wealthScore.score <= 100);
});

test("ranking 并列时按主宫分、化忌数、时间顺序打破", () => {
  const rankings = buildRankings({
    dimension: "wealth",
    timeAxis: [
      { decade_index: 0, start_age: 2, end_age: 11, label: "A", target_year: 1986 },
      { decade_index: 1, start_age: 12, end_age: 21, label: "B", target_year: 1996 },
      { decade_index: 2, start_age: 22, end_age: 31, label: "C", target_year: 2006 },
    ],
    scores: [
      { decade_index: 0, start_age: 2, end_age: 11, label: "A", value: 70 },
      { decade_index: 1, start_age: 12, end_age: 21, label: "B", value: 70 },
      { decade_index: 2, start_age: 22, end_age: 31, label: "C", value: 70 },
    ],
    mainPalaceScores: [30, 30, 28],
    jiCounts: [2, 1, 0],
  });

  assert.equal(rankings.rankings[1].rank, 1);
  assert.equal(rankings.rankings[0].rank, 2);
  assert.equal(rankings.rankings[2].rank, 3);
  assert.ok(
    rankings.trace.sorted_scores.some(
      (item) => item.tie_break_reason === "并列时按主宫得分更高者优先"
    )
  );
  assert.ok(
    rankings.trace.sorted_scores.some(
      (item) => item.tie_break_reason === "主宫仍并列时按化忌更少者优先"
    )
  );
});
