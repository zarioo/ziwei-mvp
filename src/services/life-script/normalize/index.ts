import { PALACE_KEY_ORDER, PALACE_KEY_TO_ZH } from "../constants";
import type {
  LifeScriptSourceInput,
  NormalizedLifeScriptInput,
  NormalizedPalace,
} from "../types";
import {
  categorizeSideStars,
  deriveBirthYearFromDecades,
  normalizePalaceName,
  parseDecadeMapping,
  parseRiskAlert,
  parseStar,
  parseTransformation,
} from "./parsers";

/**
 * 把原始 fortune JSON 规范化成评分引擎内部 DTO。
 *
 * 这是整个引擎里最重要的隔离层之一：
 * 上游 JSON 字段命名、标签风格、局部缺失都在这里被吸收。
 * 后面的 engine 只面对统一结构，这样规则代码才容易维护、单测也更稳定。
 */
export function normalizeLifeScriptInput(
  input: LifeScriptSourceInput
): NormalizedLifeScriptInput {
  const normalization_warnings: string[] = [];
  const natal_transformation_parse_notes: string[] = [];

  const static_palaces: NormalizedPalace[] = (input.static_palaces ?? [])
    .map((palace, fallbackIndex) => {
      const index = typeof palace.index === "number" ? palace.index : fallbackIndex;
      const { palace_key, name_zh } = normalizePalaceName(palace.name);

      if (!palace_key) {
        normalization_warnings.push(
          `static_palaces[${index}] 宫位名称无法映射，已回退为顺序宫位`
        );
      }

      const sideStars = categorizeSideStars(
        palace.minor_stars,
        palace.mini_stars,
        palace.misc_gods
      );
      const major_stars = (palace.major_stars ?? []).map(parseStar);

      for (const star of major_stars) {
        for (const transformation of star.natal_transformations) {
          if (!transformation.effect_key) {
            natal_transformation_parse_notes.push(
              `${name_zh || PALACE_KEY_TO_ZH[PALACE_KEY_ORDER[index] ?? "life"]} 的主星 ${star.raw} 含未识别生年四化标签 ${transformation.tag}`
            );
          }
        }
      }

      for (const star of [...sideStars.helper_stars, ...sideStars.malefic_stars]) {
        for (const transformation of star.natal_transformations) {
          if (!transformation.effect_key) {
            natal_transformation_parse_notes.push(
              `${name_zh || PALACE_KEY_TO_ZH[PALACE_KEY_ORDER[index] ?? "life"]} 的辅星 ${star.raw} 含未识别生年四化标签 ${transformation.tag}`
            );
          }
        }
      }

      return {
        index,
        name_zh: name_zh || PALACE_KEY_TO_ZH[PALACE_KEY_ORDER[index] ?? "life"],
        palace_key: palace_key ?? PALACE_KEY_ORDER[index] ?? "life",
        earthly_branch:
          typeof palace.earthly_branch === "string" ? palace.earthly_branch : null,
        heavenly_stem:
          typeof palace.heavenly_stem === "string" ? palace.heavenly_stem : null,
        is_body_palace: Boolean(palace.is_body_palace),
        major_stars,
        helper_stars: sideStars.helper_stars,
        malefic_stars: sideStars.malefic_stars,
        shensha: sideStars.shensha,
        other_tags: sideStars.other_tags,
        changsheng_phase:
          typeof palace.changsheng_phase?.[0] === "string"
            ? palace.changsheng_phase[0]
            : null,
        misc_gods: Object.fromEntries(
          Object.entries(palace.misc_gods ?? {}).map(([key, value]) => [
            key,
            typeof value === "string" ? value : "",
          ])
        ),
        relationships: {
          opposite_index:
            typeof palace.relationships?.oppositeIndex === "number"
              ? palace.relationships.oppositeIndex
              : null,
          wealth_trine_index:
            typeof palace.relationships?.wealthTrineIndex === "number"
              ? palace.relationships.wealthTrineIndex
              : null,
          career_trine_index:
            typeof palace.relationships?.careerTrineIndex === "number"
              ? palace.relationships.careerTrineIndex
              : null,
        },
      };
    })
    .sort((a, b) => a.index - b.index);

  const decades = (input.selected_time_slices?.decades ?? []).map((entry, index) => {
    const decade = entry.slice?.decade;
    return {
      decade_index: index,
      label: entry.label ?? decade?.name ?? `第${index + 1}段大限`,
      start_age: typeof entry.start_age === "number" ? entry.start_age : null,
      end_age: typeof entry.end_age === "number" ? entry.end_age : null,
      target_year: typeof entry.target_year === "number" ? entry.target_year : null,
      stem: typeof decade?.stem === "string" ? decade.stem : null,
      branch: typeof decade?.branch === "string" ? decade.branch : null,
      mapping: parseDecadeMapping(decade?.mapping),
      transformations: (decade?.transformations ?? []).map(parseTransformation),
      risk_alert: parseRiskAlert(decade?.risk_alert),
    };
  });

  const bodyPalaceFromMetadata =
    typeof input.metadata?.body_palace_idx === "number"
      ? input.metadata.body_palace_idx
      : null;
  const bodyPalaceFromStatic =
    static_palaces.find((palace) => palace.is_body_palace)?.index ?? null;
  const body_palace_index = bodyPalaceFromMetadata ?? bodyPalaceFromStatic;

  if (bodyPalaceFromMetadata == null && bodyPalaceFromStatic == null) {
    normalization_warnings.push("未找到身宫索引，后续仅跳过身宫细调");
  }

  const birth_year = deriveBirthYearFromDecades(decades);

  if (decades.length === 0) {
    normalization_warnings.push("selected_time_slices.decades 为空，无法计算人生剧本");
  }

  return {
    source: input,
    metadata: input.metadata ?? {},
    birth_year,
    body_palace_index,
    static_palaces,
    decades,
    debug: {
      normalization_warnings,
      natal_transformation_parse_notes,
    },
  };
}
