import assert from "node:assert/strict";
import test from "node:test";
import { createTestRules } from "../test-helpers";
import { buildPreviewSummary } from "./index";

test("summary 能判断先低后高型", () => {
  const summary = buildPreviewSummary({
    scores: {
      total_luck: [35, 40, 45, 50, 55, 60, 72, 78, 82],
      career: [30, 35, 40, 45, 50, 55, 60, 65, 70],
      wealth: [40, 42, 44, 46, 48, 50, 52, 54, 56],
      romance: [50, 48, 46, 44, 42, 40, 38, 36, 34],
      health: [55, 55, 54, 53, 52, 51, 50, 49, 48],
    },
    timeAxis: Array.from({ length: 9 }, (_, index) => ({
      decade_index: index,
      start_age: index * 10 + 2,
      end_age: index * 10 + 11,
      label: `${index}`,
      target_year: 1986 + index * 10,
    })),
    rules: createTestRules(),
  });

  assert.equal(summary.summary.overall_pattern.type, "rising_late");
  assert.equal(summary.summary.top_dimensions.length, 2);
  assert.ok(summary.summary.current_period_tip.message.length > 0);
  assert.ok(summary.trace.pattern_reason.length > 0);
});

test("summary 能判断全程平稳型", () => {
  const summary = buildPreviewSummary({
    scores: {
      total_luck: [58, 60, 59, 61, 60, 62, 59, 60, 58],
      career: [50, 50, 50, 50, 50, 50, 50, 50, 50],
      wealth: [50, 50, 50, 50, 50, 50, 50, 50, 50],
      romance: [50, 50, 50, 50, 50, 50, 50, 50, 50],
      health: [50, 50, 50, 50, 50, 50, 50, 50, 50],
    },
    timeAxis: Array.from({ length: 9 }, (_, index) => ({
      decade_index: index,
      start_age: index * 10 + 2,
      end_age: index * 10 + 11,
      label: `${index}`,
      target_year: 1986 + index * 10,
    })),
    rules: createTestRules(),
  });

  assert.equal(summary.summary.overall_pattern.type, "stable");
});
