type HoroscopeMetadata = {
  gender?: string;
  lunar_birth_date?: string;
  birth_year_stem?: string;
  five_elements_bureau?: string;
  life_master?: string;
  body_master?: string;
};

type PalaceRelationships = {
  oppositeIndex?: number;
  wealthTrineIndex?: number;
  careerTrineIndex?: number;
};

type PalaceMiscGods = {
  doctor_12?: string;
  year_12?: string;
  general_12?: string;
};

type StaticPalace = {
  index?: number;
  name?: string;
  is_body_palace?: boolean;
  earthly_branch?: string;
  heavenly_stem?: string;
  major_stars?: string[];
  minor_stars?: string[];
  mini_stars?: string[];
  changsheng_phase?: string[];
  misc_gods?: PalaceMiscGods;
  relationships?: PalaceRelationships;
};

type SliceMappingItem = {
  target_static_index?: number | null;
};

type SliceNode = {
  stem?: string;
  branch?: string;
  name?: string;
  year_date?: string;
  month_date?: string;
  day_date?: string;
  mapping?: Record<string, SliceMappingItem>;
  transformations?: string[];
  risk_alert?: string | null;
};

type DecadeSliceEntry = {
  start_age?: number;
  end_age?: number;
  target_year?: number;
  slice?: {
    decade?: SliceNode;
  };
};

type YearSliceEntry = {
  year?: number;
  slice?: {
    year?: SliceNode;
  };
};

type MonthSliceEntry = {
  year?: number;
  month?: number;
  slice?: {
    month?: SliceNode;
  };
};

type DaySliceEntry = {
  year?: number;
  month?: number;
  day?: number;
  slice?: {
    day?: SliceNode;
  };
};

export type HoroscopeTextPayload = {
  metadata?: HoroscopeMetadata;
  static_palaces?: StaticPalace[];
  selected_time_slices?: {
    decades?: DecadeSliceEntry[];
    years?: YearSliceEntry[];
    months?: MonthSliceEntry[];
    days?: DaySliceEntry[];
  };
};

const MAPPING_ORDER = [
  { key: "life_palace", label: "命" },
  { key: "sibling_palace", label: "兄" },
  { key: "spouse_palace", label: "夫" },
  { key: "children_palace", label: "子" },
  { key: "wealth_palace", label: "财" },
  { key: "health_palace", label: "疾" },
  { key: "travel_palace", label: "迁" },
  { key: "friend_palace", label: "交" },
  { key: "career_palace", label: "官" },
  { key: "property_palace", label: "田" },
  { key: "fortune_palace", label: "福" },
  { key: "parent_palace", label: "父" },
] as const;

function formatScalar(value: string | number | null | undefined): string {
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return "无";
}

function formatList(values: string[] | undefined): string {
  if (!Array.isArray(values)) return "无";
  const items = values
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));
  return items.length > 0 ? items.join(",") : "无";
}

function formatGods(miscGods: PalaceMiscGods | undefined): string {
  if (!miscGods) return "无,无,无";
  return [
    formatScalar(miscGods.doctor_12),
    formatScalar(miscGods.year_12),
    formatScalar(miscGods.general_12),
  ].join(",");
}

function formatRelationships(relationships: PalaceRelationships | undefined): string {
  if (!relationships) return "[对无,财无,官无]";
  const values = [
    `对${formatScalar(relationships.oppositeIndex)}`,
    `财${formatScalar(relationships.wealthTrineIndex)}`,
    `官${formatScalar(relationships.careerTrineIndex)}`,
  ].join(",");
  return `[${values}]`;
}

function formatMapping(mapping: Record<string, SliceMappingItem> | undefined): string {
  if (!mapping) {
    return `[${MAPPING_ORDER.map(({ label }) => `${label}无`).join(",")}]`;
  }
  return `[${MAPPING_ORDER.map(({ key, label }) => {
    const value = mapping[key]?.target_static_index;
    return `${label}${typeof value === "number" ? value : "无"}`;
  }).join(",")}]`;
}

function formatYearMonth(year: number | undefined, month: number | undefined): string {
  if (typeof year !== "number" || typeof month !== "number") {
    return "无";
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function formatYearMonthDay(
  year: number | undefined,
  month: number | undefined,
  day: number | undefined
): string {
  if (
    typeof year !== "number" ||
    typeof month !== "number" ||
    typeof day !== "number"
  ) {
    return "无";
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatSection(title: string, comment: string, lines: string[]): string {
  return [title, comment, ...lines].join("\n");
}

function formatGanzhi(stem: string | undefined, branch: string | undefined): string {
  const stemText = stem?.trim() ?? "";
  const branchText = branch?.trim() ?? "";
  if (!stemText && !branchText) return "无";
  return `${stemText}${branchText}`;
}

export function serializeHoroscopeText(payload: HoroscopeTextPayload): string {
  const metadata = payload.metadata ?? {};
  const staticPalaces = [...(payload.static_palaces ?? [])].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0)
  );
  const selectedSlices = payload.selected_time_slices ?? {};
  const bodyPalace = staticPalaces.find((palace) => palace.is_body_palace);

  const sections: string[] = [];

  sections.push(
    [
      "[Metadata]",
      `gender:${formatScalar(metadata.gender)}, lunar:${formatScalar(metadata.lunar_birth_date)}, stem:${formatScalar(metadata.birth_year_stem)}, bureau:${formatScalar(metadata.five_elements_bureau)}, life_master:${formatScalar(metadata.life_master)}, body_master:${formatScalar(metadata.body_master)}, body_palace_idx:${formatScalar(bodyPalace?.index)}`,
    ].join("\n")
  );

  sections.push(
    formatSection(
      "[Static Palaces]",
      "# 格式: Index|宫名(地支,天干)|主星|副星|小星|长生|神煞(博,岁,将)|三方四正(对,财,官)",
      staticPalaces.map((palace) =>
        [
          formatScalar(palace.index),
          `${formatScalar(palace.name)}(${formatScalar(palace.earthly_branch)},${formatScalar(palace.heavenly_stem)})`,
          formatList(palace.major_stars),
          formatList(palace.minor_stars),
          formatList(palace.mini_stars),
          formatList(palace.changsheng_phase),
          formatGods(palace.misc_gods),
          formatRelationships(palace.relationships),
        ].join("|")
      )
    )
  );

  const decadeLines = (selectedSlices.decades ?? []).map((entry) => {
    const decade = entry.slice?.decade;
    const startAge = entry.start_age;
    const endAge = entry.end_age;
    const targetYear = entry.target_year;
    const endYear =
      typeof targetYear === "number" &&
      typeof startAge === "number" &&
      typeof endAge === "number"
        ? targetYear + Math.max(endAge - startAge, 0)
        : undefined;
    return [
      typeof startAge === "number" && typeof endAge === "number"
        ? `${startAge}-${endAge}`
        : "无",
      typeof targetYear === "number" && typeof endYear === "number"
        ? `${targetYear}-${endYear}`
        : "无",
      formatGanzhi(decade?.stem, decade?.branch),
      formatMapping(decade?.mapping),
      formatList(decade?.transformations),
      formatScalar(decade?.risk_alert),
    ].join("|");
  });
  if (decadeLines.length > 0) {
    sections.push(
      formatSection(
        "[Decades]",
        "# 格式: 起止年龄|起止年份|干支|大限十二宫落在本命的Index映射|四化|风险提示",
        decadeLines
      )
    );
  }

  const yearLines = (selectedSlices.years ?? []).map((entry) => {
    const year = entry.slice?.year;
    return [
      formatScalar(year?.year_date ?? entry.year),
      formatGanzhi(year?.stem, year?.branch),
      formatMapping(year?.mapping),
      formatList(year?.transformations),
      formatScalar(year?.risk_alert),
    ].join("|");
  });
  if (yearLines.length > 0) {
    sections.push(
      formatSection(
        "[Years]",
        "# 格式: 年份|干支|流年十二宫落在本命的Index映射|四化|风险提示",
        yearLines
      )
    );
  }

  const monthLines = (selectedSlices.months ?? []).map((entry) => {
    const month = entry.slice?.month;
    return [
      formatScalar(month?.month_date ?? formatYearMonth(entry.year, entry.month)),
      formatGanzhi(month?.stem, month?.branch),
      formatMapping(month?.mapping),
      formatList(month?.transformations),
      formatScalar(month?.risk_alert),
    ].join("|");
  });
  if (monthLines.length > 0) {
    sections.push(
      formatSection(
        "[Months]",
        "# 格式: 年月|干支|流月十二宫落在本命的Index映射|四化|风险提示",
        monthLines
      )
    );
  }

  const dayLines = (selectedSlices.days ?? []).map((entry) => {
    const day = entry.slice?.day;
    return [
      formatScalar(day?.day_date ?? formatYearMonthDay(entry.year, entry.month, entry.day)),
      formatGanzhi(day?.stem, day?.branch),
      formatMapping(day?.mapping),
      formatList(day?.transformations),
      formatScalar(day?.risk_alert),
    ].join("|");
  });
  if (dayLines.length > 0) {
    sections.push(
      formatSection(
        "[Days]",
        "# 格式: 日期|干支|流日十二宫落在本命的Index映射|四化|风险提示",
        dayLines
      )
    );
  }

  return `${sections.join("\n\n")}\n`;
}
