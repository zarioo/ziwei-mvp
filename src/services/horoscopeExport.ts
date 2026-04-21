import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { getNatalAstrolabe, ZiweiBaseSchema, getHoroscope } from "@/services/iztro";
import { buildHoroscopeSlice, generateLLMPayload } from "@/utils/generateLLMPayload";
import { serializeHoroscopeText, type HoroscopeTextPayload } from "@/utils/serializeHoroscopeText";

const DATA_DIR = path.join(process.cwd(), "data");
const JSON_TO_LLM_DIR = path.join(DATA_DIR, "json-to-llm");

const SelectedDecadeSchema = z.object({
  startAge: z.number().int().min(0),
  endAge: z.number().int().min(0),
});

const SelectedMonthSchema = z.object({
  year: z.number().int().min(1),
  month: z.number().int().min(1).max(12),
});

const SelectedDaySchema = z.object({
  year: z.number().int().min(1),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

export const HoroscopeExportSchema = ZiweiBaseSchema.extend({
  fileBaseName: z.string().optional(),
  allowEmptySelection: z.boolean().optional().default(false),
  selected_decades: z.array(SelectedDecadeSchema).optional().default([]),
  selected_years: z.array(z.number().int().min(1)).optional().default([]),
  selected_months: z.array(SelectedMonthSchema).optional().default([]),
  selected_days: z.array(SelectedDaySchema).optional().default([]),
});

export type HoroscopeExportInput = z.infer<typeof HoroscopeExportSchema>;

export type DecadalOption = {
  startAge: number;
  endAge: number;
  stem: string;
  branch: string;
};

type SelectedSlicesPayload = {
  decades: Array<Record<string, unknown>>;
  years: Array<Record<string, unknown>>;
  months: Array<Record<string, unknown>>;
  days: Array<Record<string, unknown>>;
};

export class HoroscopeExportError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "HoroscopeExportError";
    this.status = status;
  }
}

async function ensureJsonToLlmDir() {
  await fs.mkdir(JSON_TO_LLM_DIR, { recursive: true });
}

export function normalizeBaseName(rawName: unknown) {
  if (typeof rawName !== "string") return "";
  const safe = rawName
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return safe.slice(0, 80);
}

function parseBirthYear(date: string) {
  const [yearText] = date.split("-");
  const year = Number(yearText);
  return Number.isFinite(year) ? year : null;
}

function buildDateForYear(date: string, year: number) {
  const [, monthText, dayText] = date.split("-");
  const month = Number(monthText);
  const day = Number(dayText);
  if (!month || !day) {
    return new Date(year, 0, 1);
  }
  const candidate = new Date(year, month - 1, day);
  if (candidate.getMonth() !== month - 1) {
    return new Date(year, month, 0);
  }
  return candidate;
}

function buildMonthKey(year: number, month: number) {
  return `${year}-${month}`;
}

function buildDayKey(year: number, month: number, day: number) {
  return `${year}-${month}-${day}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function getDecadalOptions(astrolabe: {
  palaces?: Array<{
    decadal?: {
      range?: number[];
      heavenlyStem?: string;
      earthlyBranch?: string;
    };
  }>;
}) {
  const palaces = astrolabe.palaces || [];
  return palaces
    .map((palace) => {
      const range = palace?.decadal?.range || [];
      if (!Array.isArray(range) || range.length < 2) return null;
      const [startAge, endAge] = range;
      return {
        startAge,
        endAge,
        stem: palace?.decadal?.heavenlyStem || "",
        branch: palace?.decadal?.earthlyBranch || "",
      } satisfies DecadalOption;
    })
    .filter((option): option is DecadalOption => Boolean(option))
    .sort((a, b) => a.startAge - b.startAge);
}

function getAllowedYearsFromDecades(decades: DecadalOption[], birthYear: number | null) {
  if (!birthYear || decades.length === 0) return [];
  const years = new Set<number>();
  for (const decade of decades) {
    for (let age = decade.startAge; age <= decade.endAge; age += 1) {
      years.add(birthYear + age - 1);
    }
  }
  return Array.from(years).sort((a, b) => a - b);
}

function ensureValidSelections(
  selectedSlices: SelectedSlicesPayload,
  allowEmptySelection: boolean
) {
  const hasSelection =
    selectedSlices.decades.length > 0 ||
    selectedSlices.years.length > 0 ||
    selectedSlices.months.length > 0 ||
    selectedSlices.days.length > 0;

  if (!hasSelection && !allowEmptySelection) {
    throw new HoroscopeExportError("请先选择至少一个大限 / 流年 / 流月 / 流日");
  }
}

export async function saveJsonPayload(
  payload: Record<string, unknown>,
  fileBaseName?: string
) {
  await ensureJsonToLlmDir();
  const normalizedBaseName = normalizeBaseName(fileBaseName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = normalizedBaseName
    ? `${normalizedBaseName}.json`
    : `llm-json-${timestamp}.json`;
  const filePath = path.join(JSON_TO_LLM_DIR, fileName);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return fileName;
}

async function saveTextPayload(content: string, fileBaseName?: string) {
  await ensureJsonToLlmDir();
  const normalizedBaseName = normalizeBaseName(fileBaseName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = normalizedBaseName
    ? `${normalizedBaseName}.txt`
    : `llm-text-${timestamp}.txt`;
  const filePath = path.join(JSON_TO_LLM_DIR, fileName);
  await fs.writeFile(filePath, content, "utf8");
  return fileName;
}

export async function buildHoroscopeExportPayload(input: HoroscopeExportInput) {
  const astrolabe = getNatalAstrolabe(input);
  const birthYear = parseBirthYear(input.date);
  const decadalOptions = getDecadalOptions(astrolabe);

  const finalDecades = input.selected_decades
    .map((selected) =>
      decadalOptions.find(
        (option) =>
          option.startAge === selected.startAge && option.endAge === selected.endAge
      )
    )
    .filter((option): option is DecadalOption => Boolean(option))
    .sort((a, b) => a.startAge - b.startAge);

  const allowedYears = getAllowedYearsFromDecades(finalDecades, birthYear);
  const finalYears = Array.from(new Set(input.selected_years))
    .filter((year) => allowedYears.includes(year))
    .sort((a, b) => a - b);
  const yearSet = new Set(finalYears);

  const finalMonths = Array.from(
    new Map(
      input.selected_months
        .filter((month) => yearSet.has(month.year))
        .map((month) => [buildMonthKey(month.year, month.month), month])
    ).values()
  ).sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
  const monthSet = new Set(finalMonths.map((month) => buildMonthKey(month.year, month.month)));

  const finalDays = Array.from(
    new Map(
      input.selected_days
        .filter((day) => monthSet.has(buildMonthKey(day.year, day.month)))
        .map((day) => [buildDayKey(day.year, day.month, day.day), day])
    ).values()
  )
    .filter((day) => day.day <= getDaysInMonth(day.year, day.month))
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.month !== b.month) return a.month - b.month;
      return a.day - b.day;
    });

  const basePayload = generateLLMPayload(
    astrolabe,
    null,
    {
      gender: input.gender,
      birthday: input.date,
      birthTime: "",
    },
    { includeCurrentTimeSlice: false }
  ) as Record<string, unknown>;

  const selectedSlices: SelectedSlicesPayload = {
    decades: [],
    years: [],
    months: [],
    days: [],
  };

  for (const option of finalDecades) {
    const targetYear =
      birthYear != null ? birthYear + option.startAge : new Date().getFullYear();
    const horoscope = getHoroscope(astrolabe, buildDateForYear(input.date, targetYear), input.timeIndex);
    selectedSlices.decades.push({
      label: `${option.startAge}~${option.endAge} ${option.stem}${option.branch}`.trim(),
      start_age: option.startAge,
      end_age: option.endAge,
      target_year: targetYear,
      slice: buildHoroscopeSlice(astrolabe, horoscope, {
        includeDecade: true,
        includeYear: false,
        includeMonth: false,
        includeDay: false,
      }),
    });
  }

  for (const year of finalYears) {
    const horoscope = getHoroscope(astrolabe, buildDateForYear(input.date, year), input.timeIndex);
    selectedSlices.years.push({
      label: `${year}年`,
      year,
      slice: buildHoroscopeSlice(astrolabe, horoscope, {
        includeDecade: false,
        includeYear: true,
        includeMonth: false,
        includeDay: false,
      }),
    });
  }

  for (const month of finalMonths) {
    const horoscope = getHoroscope(astrolabe, new Date(month.year, month.month - 1, 1), input.timeIndex);
    selectedSlices.months.push({
      label: `${month.year}年${month.month}月`,
      year: month.year,
      month: month.month,
      slice: buildHoroscopeSlice(astrolabe, horoscope, {
        includeDecade: false,
        includeYear: false,
        includeMonth: true,
        includeDay: false,
      }),
    });
  }

  for (const day of finalDays) {
    const horoscope = getHoroscope(astrolabe, new Date(day.year, day.month - 1, day.day), input.timeIndex);
    selectedSlices.days.push({
      label: `${day.year}年${day.month}月${day.day}日`,
      year: day.year,
      month: day.month,
      day: day.day,
      slice: buildHoroscopeSlice(astrolabe, horoscope, {
        includeDecade: false,
        includeYear: false,
        includeMonth: false,
        includeDay: true,
      }),
    });
  }

  ensureValidSelections(selectedSlices, input.allowEmptySelection);

  return {
    ...basePayload,
    selected_time_slices: selectedSlices,
  };
}

export async function exportHoroscopeJson(input: HoroscopeExportInput) {
  const payload = await buildHoroscopeExportPayload(input);
  const fileName = await saveJsonPayload(payload, input.fileBaseName);
  return { fileName, payload };
}

export async function exportHoroscopeText(input: HoroscopeExportInput) {
  const payload = (await buildHoroscopeExportPayload(input)) as HoroscopeTextPayload &
    Record<string, unknown>;
  const content = serializeHoroscopeText(payload);
  const fileName = await saveTextPayload(content, input.fileBaseName);
  return { fileName, content };
}
