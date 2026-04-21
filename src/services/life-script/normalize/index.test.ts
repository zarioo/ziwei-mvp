import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLifeScriptInput } from "./index";

test("normalizeLifeScriptInput 能统一宫位 key、身宫与 decade mapping", () => {
  const normalized = normalizeLifeScriptInput({
    metadata: {},
    static_palaces: [
      {
        index: 0,
        name: "命宫",
        is_body_palace: false,
        major_stars: ["紫微(旺)[对宫化入权]"],
        minor_stars: ["左辅", "擎羊"],
        mini_stars: ["红鸾"],
        changsheng_phase: ["帝旺"],
        misc_gods: {
          doctor_12: "博士",
        },
        relationships: {
          oppositeIndex: 6,
          wealthTrineIndex: 8,
          careerTrineIndex: 4,
        },
      },
      {
        index: 1,
        name: "福德",
        is_body_palace: true,
        major_stars: [],
        minor_stars: [],
        mini_stars: [],
        changsheng_phase: ["病"],
        misc_gods: {},
        relationships: {},
      },
    ],
    selected_time_slices: {
      decades: [
        {
          label: "2~11 丙子",
          start_age: 2,
          end_age: 11,
          target_year: 1986,
          slice: {
            decade: {
              mapping: {
                life_palace: { target_static_index: 0 },
                fortune_palace: { target_static_index: 1 },
              },
              transformations: ["天同化禄"],
              risk_alert: "廉贞-大限化忌 入 本命迁移 冲 本命命宫",
            },
          },
        },
      ],
    },
  });

  assert.equal(normalized.body_palace_index, 1);
  assert.equal(normalized.static_palaces[0].palace_key, "life");
  assert.equal(
    normalized.static_palaces[0].major_stars[0].natal_transformations.length,
    0
  );
  assert.equal(normalized.static_palaces[0].helper_stars[0].name_key, "left_support");
  assert.equal(normalized.static_palaces[0].malefic_stars[0].name_key, "qing_yang");
  assert.deepEqual(normalized.decades[0].mapping.life, 0);
  assert.deepEqual(normalized.decades[0].mapping.fortune, 1);
});

test("normalizeLifeScriptInput 在缺身宫时会给 warning", () => {
  const normalized = normalizeLifeScriptInput({
    static_palaces: [],
    selected_time_slices: { decades: [] },
  });
  assert.equal(normalized.body_palace_index, null);
  assert.ok(
    normalized.debug.normalization_warnings.some((item) => item.includes("身宫索引"))
  );
});
