import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRiskAlert,
  parseStar,
  parseTransformation,
} from "./parsers";

test("parseStar 能拆出星名、状态和标签", () => {
  const star = parseStar("廉贞(平)-[生年禄][对宫化入忌]");
  assert.equal(star.name_zh, "廉贞");
  assert.equal(star.name_key, "lian_zhen");
  assert.equal(star.state_key, "neutral");
  assert.deepEqual(star.tags, ["生年禄", "对宫化入忌"]);
  assert.deepEqual(star.natal_transformations, [
    {
      tag: "生年禄",
      effect_zh: "化禄",
      effect_key: "lu",
    },
  ]);
});

test("parseStar 解析失败时也保留 raw", () => {
  const star = parseStar("???");
  assert.equal(star.raw, "???");
  assert.equal(star.name_zh, "???");
  assert.equal(star.name_key, null);
  assert.deepEqual(star.natal_transformations, []);
});

test("parseTransformation 能解析四化结构", () => {
  const transformation = parseTransformation("天同化禄");
  assert.equal(transformation.star_key, "tian_tong");
  assert.equal(transformation.effect_key, "lu");
});

test("parseRiskAlert 能解析 enter 与 clash", () => {
  const risk = parseRiskAlert("廉贞-大限化忌 入 本命迁移 冲 本命命宫");
  assert.ok(risk);
  assert.equal(risk?.star_key, "lian_zhen");
  assert.equal(risk?.effect_key, "ji");
  assert.equal(risk?.enter_palace_key, "travel");
  assert.equal(risk?.conflict_palace_key, "life");
});

test("parseRiskAlert 失败时只保留 raw 不中断", () => {
  const risk = parseRiskAlert("这是一条解析不了的风险提示");
  assert.deepEqual(risk, { raw: "这是一条解析不了的风险提示" });
});
