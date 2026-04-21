import { promises as fs } from "fs";
import path from "path";
import { parse } from "yaml";
import { z } from "zod";
import { DIMENSION_KEY_ORDER, PALACE_KEY_ORDER } from "../constants";
import type { LifeScriptRules } from "../types";

const CONFIG_DIR = path.join(process.cwd(), "config", "life-script");

const PalaceKeySchema = z.enum(PALACE_KEY_ORDER);
const DimensionKeySchema = z.enum(DIMENSION_KEY_ORDER);

const PartialWeightedPalaceRecordSchema = z.partialRecord(PalaceKeySchema, z.number());
const PartialDimensionRecordSchema = z.partialRecord(DimensionKeySchema, z.number());

const DimensionWeightsSchema = z.object({
  dimensions: z.record(
    DimensionKeySchema,
    z.object({
      main: PartialWeightedPalaceRecordSchema,
      support: PartialWeightedPalaceRecordSchema.default({}),
      triad_reference: PalaceKeySchema,
      triad_weight: z.number(),
      body_weight: z.number(),
      module_caps: z.object({
        major_star: z.number(),
        side_star: z.number(),
      }),
      normalization: z.object({
        min_raw: z.number(),
        max_raw: z.number(),
      }),
    })
  ),
  static_adjustment: z.object({
    min: z.number(),
    max: z.number(),
  }),
  body_adjustment: z.object({
    relation_coeff: z.object({
      main: z.number(),
      support: z.number(),
      triad: z.number(),
      weak_related: z.number(),
      none: z.number(),
    }),
  }),
});

const StarStateCoeffSchema = z.object({
  star_state_coeff: z.object({
    temple: z.number(),
    prosperous: z.number(),
    neutral: z.number(),
    weak: z.number(),
  }),
});

const StarBaseScoresSchema = z.object({
  star_base_scores: z.record(z.string(), PartialDimensionRecordSchema),
});

const PalaceAffinitySchema = z.object({
  palace_affinity: z.record(z.string(), PartialWeightedPalaceRecordSchema),
});

const HelperStarsSchema = z.object({
  helper_stars: z.record(z.string(), PartialDimensionRecordSchema),
});

const MaleficStarsSchema = z.object({
  malefic_stars: z.record(z.string(), PartialDimensionRecordSchema),
});

const ChangshengSchema = z.object({
  changsheng: z.record(z.string(), z.number()),
});

const MiscGodsSchema = z.object({
  misc_gods: z.record(z.string(), PartialDimensionRecordSchema),
});

const TransformationsSchema = z.object({
  transformations: z.object({
    natal_scores: z.object({
      lu: z.number(),
      quan: z.number(),
      ke: z.number(),
      ji: z.number(),
    }),
    decade_scores: z.object({
      lu: z.number(),
      quan: z.number(),
      ke: z.number(),
      ji: z.number(),
    }),
  }),
});

const RiskAlertSchema = z.object({
  risk_alert: z.object({
    conflict_scores: z.partialRecord(PalaceKeySchema, PartialDimensionRecordSchema),
  }),
});

const NormalizationSchema = z.object({
  normalization: z.object({
    display_min: z.number(),
    display_max: z.number(),
  }),
});

const SummaryTemplatesSchema = z.object({
  summary_templates: z.object({
    patterns: z.record(z.string(), z.string()),
    current_period_templates: z.object({
      high: z.string(),
      middle: z.string(),
      low: z.string(),
    }),
    dimension_brief_templates: z.object({
      high: z.string(),
      middle: z.string(),
      low: z.string(),
    }),
  }),
});

let cachedRules: LifeScriptRules | null = null;

/**
 * 读取单个 YAML 文件并做 schema 校验。
 *
 * 这里把“读文件”和“校验配置”绑定在一起，是为了让错误尽量早暴露。
 * 如果只读不校验，后面在计算时才爆出 undefined，会很难定位到底是哪份规则写错了。
 */
async function readYamlConfig<T>(
  fileName: string,
  schema: z.ZodSchema<T>
): Promise<T> {
  const filePath = path.join(CONFIG_DIR, fileName);
  const content = await fs.readFile(filePath, "utf8");
  const parsed = parse(content);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `life-script 配置校验失败: ${fileName} ${result.error.message}`
    );
  }
  return result.data;
}

/**
 * 加载评分引擎的全部规则配置。
 *
 * 这个函数是“参数入口”，评分引擎后续所有纯函数都只依赖已经校验过的规则对象。
 * 这样做的好处是：
 * 1. 计算层不需要反复处理缺省值和脏数据
 * 2. 后期改规则时，主要工作集中在 YAML，而不是业务逻辑
 */
export async function loadLifeScriptRules(): Promise<LifeScriptRules> {
  if (cachedRules) {
    return cachedRules;
  }

  const [
    dimensionWeights,
    starStateCoeff,
    starBaseScores,
    palaceAffinity,
    helperStars,
    maleficStars,
    changsheng,
    miscGods,
    transformations,
    riskAlert,
    normalization,
    summaryTemplates,
  ] = await Promise.all([
    readYamlConfig("dimension-weights.yaml", DimensionWeightsSchema),
    readYamlConfig("star-state-coeff.yaml", StarStateCoeffSchema),
    readYamlConfig("star-base-scores.yaml", StarBaseScoresSchema),
    readYamlConfig("palace-affinity.yaml", PalaceAffinitySchema),
    readYamlConfig("helper-stars.yaml", HelperStarsSchema),
    readYamlConfig("malefic-stars.yaml", MaleficStarsSchema),
    readYamlConfig("changsheng.yaml", ChangshengSchema),
    readYamlConfig("misc-gods.yaml", MiscGodsSchema),
    readYamlConfig("transformations.yaml", TransformationsSchema),
    readYamlConfig("risk-alert.yaml", RiskAlertSchema),
    readYamlConfig("normalization.yaml", NormalizationSchema),
    readYamlConfig("summary-templates.yaml", SummaryTemplatesSchema),
  ]);

  cachedRules = {
    dimension_weights: dimensionWeights.dimensions,
    star_state_coeff: starStateCoeff.star_state_coeff,
    star_base_scores: starBaseScores.star_base_scores,
    palace_affinity: palaceAffinity.palace_affinity,
    helper_stars: helperStars.helper_stars,
    malefic_stars: maleficStars.malefic_stars,
    changsheng: changsheng.changsheng,
    misc_gods: miscGods.misc_gods,
    transformations: transformations.transformations,
    risk_alert: riskAlert.risk_alert,
    body_adjustment: dimensionWeights.body_adjustment,
    normalization: normalization.normalization,
    static_adjustment: dimensionWeights.static_adjustment,
    summary_templates: summaryTemplates.summary_templates,
  };

  return cachedRules;
}

export function clearLifeScriptRulesCache() {
  cachedRules = null;
}
