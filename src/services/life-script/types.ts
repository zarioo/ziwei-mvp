import type {
  DimensionKey,
  PalaceKey,
  RelationType,
  StarStateKey,
  TransformationEffectKey,
} from "./constants";

/**
 * 这里定义评分引擎输入、规范化 DTO、规则配置和输出类型。
 *
 * 这样拆的目的是把“原始 fortune JSON 长什么样”和“引擎内部如何理解它”
 * 明确区分开。后续如果上游字段有微调，只需要优先改 normalize，
 * 不需要把评分公式一起改坏。
 */

export type HoroscopeMetadata = {
  gender?: string;
  lunar_birth_date?: string;
  birth_year_stem?: string;
  five_elements_bureau?: string;
  life_master?: string;
  body_master?: string;
  body_palace_idx?: number;
};

export type StaticPalaceInput = {
  index?: number;
  name?: string;
  is_body_palace?: boolean;
  earthly_branch?: string;
  heavenly_stem?: string;
  major_stars?: string[];
  minor_stars?: string[];
  mini_stars?: string[];
  changsheng_phase?: string[];
  misc_gods?: Record<string, string | undefined>;
  relationships?: {
    oppositeIndex?: number;
    wealthTrineIndex?: number;
    careerTrineIndex?: number;
  };
};

export type DecadeSliceInput = {
  label?: string;
  start_age?: number;
  end_age?: number;
  target_year?: number;
  slice?: {
    decade?: {
      name?: string;
      stem?: string;
      branch?: string;
      mapping?: Record<
        string,
        {
          target_static_index?: number | null;
          overlapping_text?: string;
        }
      >;
      transformations?: string[];
      risk_alert?: string | null;
    };
  };
};

export type LifeScriptSourceInput = {
  metadata?: HoroscopeMetadata;
  static_palaces?: StaticPalaceInput[];
  selected_time_slices?: {
    decades?: DecadeSliceInput[];
  };
};

export type NormalizedStar = {
  raw: string;
  name_zh: string | null;
  name_key: string | null;
  state_zh: string | null;
  state_key: StarStateKey | null;
  tags: string[];
  natal_transformations: Array<{
    tag: string;
    effect_zh: string | null;
    effect_key: TransformationEffectKey | null;
  }>;
};

export type NormalizedCategorizedStars = {
  helper_stars: NormalizedStar[];
  malefic_stars: NormalizedStar[];
  shensha: string[];
  other_tags: string[];
};

export type NormalizedRiskAlert = {
  raw: string;
  star_zh?: string | null;
  star_key?: string | null;
  effect_zh?: string | null;
  effect_key?: TransformationEffectKey | null;
  enter_palace_zh?: string | null;
  enter_palace_key?: PalaceKey | null;
  conflict_palace_zh?: string | null;
  conflict_palace_key?: PalaceKey | null;
};

export type NormalizedTransformation = {
  raw: string;
  star_zh: string | null;
  star_key: string | null;
  effect_zh: string | null;
  effect_key: TransformationEffectKey | null;
};

export type NormalizedPalace = {
  index: number;
  name_zh: string;
  palace_key: PalaceKey;
  earthly_branch: string | null;
  heavenly_stem: string | null;
  is_body_palace: boolean;
  major_stars: NormalizedStar[];
  helper_stars: NormalizedStar[];
  malefic_stars: NormalizedStar[];
  shensha: string[];
  other_tags: string[];
  changsheng_phase: string | null;
  misc_gods: Record<string, string>;
  relationships: {
    opposite_index: number | null;
    wealth_trine_index: number | null;
    career_trine_index: number | null;
  };
};

export type NormalizedDecade = {
  decade_index: number;
  label: string;
  start_age: number | null;
  end_age: number | null;
  target_year: number | null;
  stem: string | null;
  branch: string | null;
  mapping: Record<PalaceKey, number | null>;
  transformations: NormalizedTransformation[];
  risk_alert: NormalizedRiskAlert | null;
};

export type NormalizedLifeScriptInput = {
  source: LifeScriptSourceInput;
  metadata: HoroscopeMetadata;
  birth_year: number | null;
  body_palace_index: number | null;
  static_palaces: NormalizedPalace[];
  decades: NormalizedDecade[];
  debug: {
    normalization_warnings: string[];
    natal_transformation_parse_notes: string[];
  };
};

export type DimensionWeightRule = {
  main: Partial<Record<PalaceKey, number>>;
  support: Partial<Record<PalaceKey, number>>;
  triad_reference: PalaceKey;
  triad_weight: number;
  body_weight: number;
  module_caps: {
    major_star: number;
    side_star: number;
  };
  normalization: {
    min_raw: number;
    max_raw: number;
  };
};

export type TransformationRules = {
  natal_scores: Record<TransformationEffectKey, number>;
  decade_scores: Record<TransformationEffectKey, number>;
};

export type RiskAlertRules = {
  conflict_scores: Partial<Record<PalaceKey, Partial<Record<DimensionKey, number>>>>;
};

export type BodyAdjustmentRules = {
  relation_coeff: Record<RelationType | "none", number>;
};

export type NormalizationRules = {
  display_min: number;
  display_max: number;
};

export type StaticAdjustmentRules = {
  min: number;
  max: number;
};

export type SummaryTemplates = {
  patterns: Record<string, string>;
  current_period_templates: {
    high: string;
    middle: string;
    low: string;
  };
  dimension_brief_templates: {
    high: string;
    middle: string;
    low: string;
  };
};

export type LifeScriptRules = {
  dimension_weights: Record<DimensionKey, DimensionWeightRule>;
  star_state_coeff: Record<StarStateKey, number>;
  star_base_scores: Record<string, Partial<Record<DimensionKey, number>>>;
  palace_affinity: Record<string, Partial<Record<PalaceKey, number>>>;
  helper_stars: Record<string, Partial<Record<DimensionKey, number>>>;
  malefic_stars: Record<string, Partial<Record<DimensionKey, number>>>;
  changsheng: Record<string, number>;
  misc_gods: Record<string, Partial<Record<DimensionKey, number>>>;
  transformations: TransformationRules;
  risk_alert: RiskAlertRules;
  body_adjustment: BodyAdjustmentRules;
  normalization: NormalizationRules;
  static_adjustment: StaticAdjustmentRules;
  summary_templates: SummaryTemplates;
};

export type PalaceContributionBreakdown = {
  major_star_total_before_cap: number;
  major_star_total_after_cap: number;
  side_star_total_before_cap: number;
  side_star_total_after_cap: number;
  small_star_adjustment: number;
  changsheng_adjustment: number;
  shensha_adjustment: number;
  static_adjustment_before_cap: number;
  static_adjustment_after_cap: number;
  natal_transformation_adjustment: number;
  decade_transformation_adjustment: number;
  total: number;
};

export type MajorStarContributionTrace = {
  raw: string;
  star_zh: string | null;
  star_key: string | null;
  state_zh: string | null;
  state_key: StarStateKey | null;
  dimension_base_score: number;
  state_coeff: number;
  palace_affinity_coeff: number;
  final_contribution: number;
  explanation: string;
};

export type SideStarContributionTrace = {
  raw: string;
  star_zh: string | null;
  star_key: string | null;
  state_zh: string | null;
  state_key: StarStateKey | null;
  dimension_base_score: number;
  state_coeff: number;
  palace_affinity_coeff: number;
  final_contribution: number;
  explanation: string;
};

export type ChangshengTrace = {
  changsheng_phase: string | null;
  adjustment: number;
  explanation: string;
};

export type MiscGodContributionTrace = {
  god: string;
  adjustment: number;
  explanation: string;
};

export type TransformationContributionTrace = {
  transformation_type: "natal" | "decade";
  raw: string;
  star_zh: string | null;
  star_key: string | null;
  effect_zh: string | null;
  effect_key: TransformationEffectKey | null;
  hit_current_palace: boolean;
  base_score: number;
  actual_contribution: number;
  explanation: string;
};

export type RiskContributionTrace = {
  raw: string | null;
  parsed: NormalizedRiskAlert | null;
  conflict_palace_key: PalaceKey | null;
  conflict_palace_zh: string | null;
  applied_score: number;
  explanation: string;
};

export type PalaceScoreDebug = {
  palace_index: number;
  palace_key: PalaceKey;
  palace_zh_name: string;
  relation: RelationType;
  ji_transformation_count: number;
  palace_score_total: number;
  breakdown: PalaceContributionBreakdown;
  major_star_details: MajorStarContributionTrace[];
  side_star_details: SideStarContributionTrace[];
  small_star_details: MiscGodContributionTrace[];
  changsheng_detail: ChangshengTrace;
  shensha_details: MiscGodContributionTrace[];
  transformation_details: TransformationContributionTrace[];
  explanation_lines: string[];
};

export type DimensionScoreDebug = {
  dimension: DimensionKey;
  weights: {
    main: Partial<Record<PalaceKey, number>>;
    support: Partial<Record<PalaceKey, number>>;
    triad_reference: PalaceKey;
    triad_weight: number;
    body_weight: number;
  };
  main_palace: {
    palace_key: PalaceKey;
    static_index: number | null;
  };
  support_palaces: Array<{
    palace_key: PalaceKey;
    static_index: number | null;
  }>;
  triad: {
    triad_reference_palace_key: PalaceKey;
    triad_reference_static_index: number | null;
    relationships: {
      opposite_index: number | null;
      wealth_trine_index: number | null;
      career_trine_index: number | null;
    } | null;
    triad_indices: number[];
    palace_scores: Array<{
      palace_index: number;
      score: number;
    }>;
    average_score: number;
    triad_weight: number;
    weighted_contribution: number;
  };
  raw_weighted_score: number;
  risk_adjustment: RiskContributionTrace;
  raw_score_after_risk: number;
  normalization: {
    raw_min: number;
    raw_max: number;
    ratio: number;
    display_min: number;
    display_max: number;
    normalized_score: number;
    clamped_score: number;
  };
  main_palace_score: number;
  support_palace_scores: Array<{
    palace_key: PalaceKey;
    weight: number;
    score: number;
  }>;
  triad_palace_scores: Array<{
    palace_index: number;
    score: number;
  }>;
  body_adjustment: {
    score: number;
    relation: RelationType | "none";
    palace_index: number | null;
  };
  weighted_contributions: {
    main: number;
    support: number;
    triad: number;
    body: number;
  };
  palace_details: PalaceScoreDebug[];
  explanation_summary: string;
  explanation_steps: string[];
};

export type LifeScriptScorePoint = {
  decade_index: number;
  start_age: number | null;
  end_age: number | null;
  label: string;
  value: number;
};

export type LifeScriptRankingPoint = {
  decade_index: number;
  start_age: number | null;
  end_age: number | null;
  label: string;
  rank: number;
  score: number;
};

export type TimeAxisPoint = {
  decade_index: number;
  start_age: number | null;
  end_age: number | null;
  label: string;
  target_year: number | null;
};

export type PreviewSummary = {
  overall_pattern: {
    type: string;
    description: string;
  };
  top_dimensions: Array<{
    dimension: DimensionKey;
    dimension_zh: string;
    peak_score: number;
  }>;
  peak_periods: TimeAxisPoint[];
  low_periods: TimeAxisPoint[];
  current_period_tip: {
    current_age: number | null;
    current_period: TimeAxisPoint | null;
    message: string;
  };
};

export type LifeScriptFacts = {
  time_axis: TimeAxisPoint[];
  scores: Record<DimensionKey, LifeScriptScorePoint[]>;
  rankings: Record<DimensionKey, LifeScriptRankingPoint[]>;
  peak_periods: TimeAxisPoint[];
  low_periods: TimeAxisPoint[];
  current_period: TimeAxisPoint | null;
  pattern_type: string;
  dimension_briefs: Record<DimensionKey, string>;
};

export type DecadeResult = {
  decade: NormalizedDecade;
  scores: Record<DimensionKey, number>;
  debug: Record<DimensionKey, DimensionScoreDebug>;
};

export type InputSnapshotTrace = {
  metadata: HoroscopeMetadata;
  body_palace_index: number | null;
  time_axis_source: string;
  normalized_summary: {
    static_palace_count: number;
    decade_count: number;
    normalization_warnings: string[];
    natal_transformation_parse_notes: string[];
  };
};

export type RankingTrace = {
  per_dimension: Record<
    DimensionKey,
    {
      raw_scores: Array<{
        decade_index: number;
        label: string;
        score: number;
        main_palace_score: number;
        ji_count: number;
      }>;
      sorted_scores: Array<{
        decade_index: number;
        label: string;
        score: number;
        main_palace_score: number;
        ji_count: number;
        rank: number;
        tie_break_reason: string;
      }>;
    }
  >;
};

export type SummaryTrace = {
  total_luck_scores: number[];
  pattern_type: string;
  pattern_reason: string;
  top_dimensions_reason: string;
  peak_periods_reason: string;
  low_periods_reason: string;
  current_period_reason: string;
};

export type DebugTrace = {
  input_snapshot: InputSnapshotTrace;
  per_decade: Array<{
    decade_label: string;
    start_age: number | null;
    end_age: number | null;
    mapping: Record<PalaceKey, number | null>;
    dimensions: Record<DimensionKey, DimensionScoreDebug>;
  }>;
  rankings_trace: RankingTrace;
  summary_trace: SummaryTrace;
  normalization_warnings: string[];
  natal_transformation_parse_notes: string[];
  fallbacks: string[];
};

export type LifeScriptCoreResult = {
  scores: Record<DimensionKey, LifeScriptScorePoint[]>;
  rankings: Record<DimensionKey, LifeScriptRankingPoint[]>;
  time_axis: TimeAxisPoint[];
  preview_summary: PreviewSummary;
  llm_facts: LifeScriptFacts;
};

export type LifeScriptDebugPayload = {
  debug_trace: DebugTrace;
  debug_markdown: string;
};

export type LifeScriptResult = LifeScriptCoreResult & Partial<LifeScriptDebugPayload>;

export type GenerateLifeScriptOptions = {
  debug?: boolean;
};
