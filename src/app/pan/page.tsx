"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PanShell from "@/components/PanShell";
import IztrolabeServer from "@/components/IztrolabeServer";
import { buildHoroscopeSlice, generateLLMPayload } from "@/utils/generateLLMPayload";
import { serializeHoroscopeText } from "@/utils/serializeHoroscopeText";

import styles from "./page.module.css";

const TIME_INDEX_OPTIONS = [
  { value: 0, label: "早子时 (00:00~00:59)" },
  { value: 1, label: "丑时 (01:00~02:59)" },
  { value: 2, label: "寅时 (03:00~04:59)" },
  { value: 3, label: "卯时 (05:00~06:59)" },
  { value: 4, label: "辰时 (07:00~08:59)" },
  { value: 5, label: "巳时 (09:00~10:59)" },
  { value: 6, label: "午时 (11:00~12:59)" },
  { value: 7, label: "未时 (13:00~14:59)" },
  { value: 8, label: "申时 (15:00~16:59)" },
  { value: 9, label: "酉时 (17:00~18:59)" },
  { value: 10, label: "戌时 (19:00~20:59)" },
  { value: 11, label: "亥时 (21:00~22:59)" },
  { value: 12, label: "晚子时 (23:00~23:59)" },
] as const;

type FormState = {
  name: string;
  gender: "男" | "女";
  birthday: string;
  birthTime: string;
  birthplace: string;
};

type PanelInput = {
  calendar: "solar" | "lunar";
  date: string;
  timeIndex: number;
  gender: "男" | "女";
  fixLeap?: boolean;
  isLeapMonth?: boolean;
  language?: string;
};

type NatalResult = {
  solarBirthDate: string | null;
  lunarBirthDate: string | null;
  wuxingju: string | null;
  mingzhu: string | null;
  shenzhu: string | null;
  palaces: Array<{
    displayName: string | null;
    dizhi: string | null;
    tianGan: string | null;
    majorStars: Array<{ name: string | null }>;
    minorStars: Array<{ name: string | null }>;
  }>;
};

type NatalApiResponse = NatalResult & {
  rawAstrolabe: any;
  rawHoroscope: any;
  horoscopeDate: string;
  horoscopeHour: number;
};

type DecadalOption = {
  id: string;
  label: string;
  subLabel: string;
  startAge: number;
  endAge: number;
  stem: string;
  branch: string;
  palaceIndex: number;
};

type MonthOption = {
  key: string;
  label: string;
  year: number;
  month: number;
};

type DayOption = {
  key: string;
  label: string;
  year: number;
  month: number;
  day: number;
};

type BackendHoroscopeExportRequest = PanelInput & {
  fileBaseName?: string;
  allowEmptySelection?: boolean;
  selected_decades: Array<{
    startAge: number;
    endAge: number;
  }>;
  selected_years: number[];
  selected_months: Array<{
    year: number;
    month: number;
  }>;
  selected_days: Array<{
    year: number;
    month: number;
    day: number;
  }>;
};

type SavedChart = {
  id: string;
  createdAt: string;
  form: FormState;
  input: PanelInput;
  result?: NatalResult;
};

type PersistedPanState = {
  form: FormState;
  panelInput: PanelInput | null;
  result: NatalResult | null;
  rawAstrolabe: any;
  rawHoroscope: any;
  horoscopeDateIso: string | null;
  horoscopeHour: number;
  selectedDecadalIds: string[];
  selectedYears: number[];
  selectedMonthKeys: string[];
  selectedDayKeys: string[];
  currentDecadalId: string;
  currentYear: number | null;
  currentMonthKey: string;
  currentDayKey: string;
};

const DEFAULT_FORM: FormState = {
  name: "",
  gender: "女",
  birthday: "1991-08-26",
  birthTime: "20:00",
  birthplace: "",
};
const PAN_PAGE_STATE_KEY = "ziwei-pan-page-state-v1";

function toTimeIndex(time: string): number {
  if (!time) return 0;
  const [hourStr, minuteStr] = time.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;
  const minutes = hour * 60 + minute;
  if (minutes >= 23 * 60) return 12;
  if (minutes < 60) return 0;
  return Math.floor((minutes - 60) / 120) + 1;
}

function buildMonthKey(year: number, month: number) {
  return `${year}-${month}`;
}

function buildDayKey(year: number, month: number, day: number) {
  return `${year}-${month}-${day}`;
}

function normalizeNameForFile(name: string) {
  const safe = name
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, "")
    .slice(0, 40);
  return safe || "user";
}

function formatTodayMMDD() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${mm}${dd}`;
}

function formatNowHHmmss() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${hh}${mm}${ss}`;
}

function buildFortuneFileBaseName(name: string) {
  return `${normalizeNameForFile(name || "user")}${formatTodayMMDD()}-${formatNowHHmmss()}-fortune`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export default function PanPage() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [panelInput, setPanelInput] = useState<PanelInput | null>(null);
  const [result, setResult] = useState<NatalResult | null>(null);
  const [rawAstrolabe, setRawAstrolabe] = useState<any>(null);
  const [rawHoroscope, setRawHoroscope] = useState<any>(null);
  const [horoscopeDate, setHoroscopeDate] = useState<Date | null>(null);
  const [horoscopeHour, setHoroscopeHour] = useState<number>(0);
  const [horoscopeLoading, setHoroscopeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [selectedChartId, setSelectedChartId] = useState("");
  const [openPicker, setOpenPicker] = useState<
    "decadal" | "yearly" | "monthly" | "daily" | null
  >(null);
  const [selectedDecadalIds, setSelectedDecadalIds] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedMonthKeys, setSelectedMonthKeys] = useState<string[]>([]);
  const [selectedDayKeys, setSelectedDayKeys] = useState<string[]>([]);
  const [currentDecadalId, setCurrentDecadalId] = useState("");
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [currentMonthKey, setCurrentMonthKey] = useState("");
  const [currentDayKey, setCurrentDayKey] = useState("");
  const [pendingDecadalIds, setPendingDecadalIds] = useState<string[]>([]);
  const [pendingYears, setPendingYears] = useState<number[]>([]);
  const [pendingMonthKeys, setPendingMonthKeys] = useState<string[]>([]);
  const [pendingDayKeys, setPendingDayKeys] = useState<string[]>([]);
  const [horoscopeJsonLoading, setHoroscopeJsonLoading] = useState(false);
  const [horoscopeTextLoading, setHoroscopeTextLoading] = useState(false);
  const [backendHoroscopeJsonLoading, setBackendHoroscopeJsonLoading] = useState(false);
  const [backendHoroscopeTextLoading, setBackendHoroscopeTextLoading] = useState(false);
  const [aiLaunching, setAiLaunching] = useState(false);
  const [manualFortuneFileBaseName, setManualFortuneFileBaseName] = useState("");
  const [backendFortuneFileBaseName, setBackendFortuneFileBaseName] = useState("");
  const hasRestoredStateRef = useRef(false);

  const timeIndex = useMemo(() => toTimeIndex(form.birthTime), [form.birthTime]);
  const timeLabel =
    TIME_INDEX_OPTIONS.find((item) => item.value === timeIndex)?.label || "";

  const birthYear = useMemo(() => {
    const yearText = form.birthday?.split("-")?.[0];
    const yearNum = Number(yearText);
    return Number.isNaN(yearNum) ? null : yearNum;
  }, [form.birthday]);
  const exportBusy = horoscopeJsonLoading || horoscopeTextLoading || aiLaunching;
  const backendExportBusy =
    backendHoroscopeJsonLoading || backendHoroscopeTextLoading;

  useEffect(() => {
    setManualFortuneFileBaseName("");
    setBackendFortuneFileBaseName("");
  }, [
    form.name,
    rawAstrolabe,
    rawHoroscope,
    selectedDecadalIds,
    selectedYears,
    selectedMonthKeys,
    selectedDayKeys,
  ]);

  const getAllowedYearsFromDecadals = (decadalIds: string[]) => {
    // 根据大限年龄范围换算出可选流年，确保流年只能在上层范围内选择
    if (!birthYear || decadalIds.length === 0) return [];
    const ranges = decadalIds
      .map((id) => decadalOptions.find((option) => option.id === id))
      .filter(Boolean) as DecadalOption[];
    const years = new Set<number>();
    for (const range of ranges) {
      for (let age = range.startAge; age <= range.endAge; age += 1) {
        years.add(birthYear + age - 1);
      }
    }
    return Array.from(years).sort((a, b) => a - b);
  };

  const decadalOptions = useMemo<DecadalOption[]>(() => {
    const palaces = rawAstrolabe?.palaces || [];
    return palaces
      .map((palace: any) => {
        const range = palace?.decadal?.range || [];
        if (!Array.isArray(range) || range.length < 2) return null;
        const [startAge, endAge] = range;
        const stem = palace?.decadal?.heavenlyStem || "";
        const branch = palace?.decadal?.earthlyBranch || "";
        return {
          id: `${startAge}-${endAge}`,
          label: `${startAge}~${endAge}`,
          subLabel: `${stem}${branch}`,
          startAge,
          endAge,
          stem,
          branch,
          palaceIndex: palace?.index ?? -1,
        };
      })
      .filter(Boolean)
      .sort((a: DecadalOption, b: DecadalOption) => a.startAge - b.startAge);
  }, [rawAstrolabe]);

  const yearOptions = useMemo(() => {
    return getAllowedYearsFromDecadals(selectedDecadalIds);
  }, [selectedDecadalIds, birthYear, decadalOptions]);

  const monthOptions = useMemo<MonthOption[]>(() => {
    const baseYears = selectedYears.filter((year) => yearOptions.includes(year));
    return baseYears.flatMap((year) =>
      Array.from({ length: 12 }, (_, idx) => {
        const month = idx + 1;
        return {
          key: buildMonthKey(year, month),
          label: `${year}年${month}月`,
          year,
          month,
        };
      })
    );
  }, [selectedYears, yearOptions]);

  const dayOptions = useMemo<DayOption[]>(() => {
    // 流日基于“已选择的流月”，避免一次性显示过多日期
    const monthSet = new Set(monthOptions.map((item) => item.key));
    const baseMonths = selectedMonthKeys
      .filter((key) => monthSet.has(key))
      .map((key) => {
        const [yearText, monthText] = key.split("-");
        const year = Number(yearText);
        const month = Number(monthText);
        return { year, month };
      })
      .filter((item) => item.year > 0 && item.month > 0);

    return baseMonths.flatMap(({ year, month }) => {
      const dayCount = getDaysInMonth(year, month);
      return Array.from({ length: dayCount }, (_, idx) => {
        const day = idx + 1;
        return {
          key: buildDayKey(year, month, day),
          label: `${year}年${month}月${day}日`,
          year,
          month,
          day,
        };
      });
    });
  }, [selectedMonthKeys, monthOptions]);

  const currentDecadalOption = decadalOptions.find(
    (item) => item.id === currentDecadalId
  );
  const currentMonthOption = monthOptions.find(
    (item) => item.key === currentMonthKey
  );
  const currentDayOption = dayOptions.find((item) => item.key === currentDayKey);

  useEffect(() => {
    // 从 sessionStorage 恢复盘面状态：即使用户从 AI 页返回或误刷新，也尽量保留上次选择
    try {
      const raw = sessionStorage.getItem(PAN_PAGE_STATE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as PersistedPanState;
      if (!state || typeof state !== "object") return;
      setForm(state.form ?? DEFAULT_FORM);
      setPanelInput(state.panelInput ?? null);
      setResult(state.result ?? null);
      setRawAstrolabe(state.rawAstrolabe ?? null);
      setRawHoroscope(state.rawHoroscope ?? null);
      setHoroscopeDate(
        state.horoscopeDateIso ? new Date(state.horoscopeDateIso) : null
      );
      setHoroscopeHour(
        typeof state.horoscopeHour === "number" ? state.horoscopeHour : 0
      );
      setSelectedDecadalIds(
        Array.isArray(state.selectedDecadalIds) ? state.selectedDecadalIds : []
      );
      setSelectedYears(Array.isArray(state.selectedYears) ? state.selectedYears : []);
      setSelectedMonthKeys(
        Array.isArray(state.selectedMonthKeys) ? state.selectedMonthKeys : []
      );
      setSelectedDayKeys(
        Array.isArray(state.selectedDayKeys) ? state.selectedDayKeys : []
      );
      setCurrentDecadalId(state.currentDecadalId || "");
      setCurrentYear(typeof state.currentYear === "number" ? state.currentYear : null);
      setCurrentMonthKey(state.currentMonthKey || "");
      setCurrentDayKey(state.currentDayKey || "");
    } catch {
      // 忽略恢复失败，避免影响正常排盘流程
    } finally {
      hasRestoredStateRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hasRestoredStateRef.current) return;
    const nextState: PersistedPanState = {
      form,
      panelInput,
      result,
      rawAstrolabe,
      rawHoroscope,
      horoscopeDateIso: horoscopeDate ? horoscopeDate.toISOString() : null,
      horoscopeHour,
      selectedDecadalIds,
      selectedYears,
      selectedMonthKeys,
      selectedDayKeys,
      currentDecadalId,
      currentYear,
      currentMonthKey,
      currentDayKey,
    };
    try {
      sessionStorage.setItem(PAN_PAGE_STATE_KEY, JSON.stringify(nextState));
    } catch {
      // 某些隐私模式可能禁止写入，本地缓存失败时保持静默
    }
  }, [
    form,
    panelInput,
    result,
    rawAstrolabe,
    rawHoroscope,
    horoscopeDate,
    horoscopeHour,
    selectedDecadalIds,
    selectedYears,
    selectedMonthKeys,
    selectedDayKeys,
    currentDecadalId,
    currentYear,
    currentMonthKey,
    currentDayKey,
  ]);

  useEffect(() => {
    // 页面加载时尝试读取登录状态，避免用户每次都要手动输入邮箱
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.email) {
          setUserEmail(data.email);
          setEmailInput(data.email);
          refreshCharts();
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!rawHoroscope || decadalOptions.length === 0) return;
    const match =
      decadalOptions.find(
        (item) => item.palaceIndex === rawHoroscope?.decadal?.index
      ) ?? decadalOptions[0];
    if (match) {
      setCurrentDecadalId(match.id);
    }
  }, [rawHoroscope, decadalOptions]);

  useEffect(() => {
    if (!horoscopeDate) return;
    const year = horoscopeDate.getFullYear();
    const month = horoscopeDate.getMonth() + 1;
    const day = horoscopeDate.getDate();
    setCurrentYear(year);
    setCurrentMonthKey(buildMonthKey(year, month));
    setCurrentDayKey(buildDayKey(year, month, day));
  }, [horoscopeDate]);

  useEffect(() => {
    if (!currentMonthKey || monthOptions.length === 0) return;
    const exists = monthOptions.some((item) => item.key === currentMonthKey);
    if (!exists) {
      setCurrentMonthKey(monthOptions[0].key);
    }
  }, [currentMonthKey, monthOptions]);

  useEffect(() => {
    if (!currentDayKey || dayOptions.length === 0) return;
    const exists = dayOptions.some((item) => item.key === currentDayKey);
    if (!exists) {
      setCurrentDayKey(dayOptions[0].key);
    }
  }, [currentDayKey, dayOptions]);


  const toApiDate = (value: string) => {
    // 后端要求 YYYY-M-D，去掉日期中的前导零
    const [y, m, d] = value.split("-");
    if (!y || !m || !d) return value;
    return `${Number(y)}-${Number(m)}-${Number(d)}`;
  };

  const openDecadalPicker = () => {
    setPendingDecadalIds(selectedDecadalIds);
    setOpenPicker("decadal");
  };

  const openYearlyPicker = () => {
    setPendingYears(selectedYears);
    setOpenPicker("yearly");
  };

  const openMonthlyPicker = () => {
    setPendingMonthKeys(selectedMonthKeys);
    setOpenPicker("monthly");
  };

  const openDailyPicker = () => {
    setPendingDayKeys(selectedDayKeys);
    setOpenPicker("daily");
  };

  const shiftDecadal = (step: number) => {
    if (decadalOptions.length === 0) return;
    const currentIndex = Math.max(
      0,
      decadalOptions.findIndex((item) => item.id === currentDecadalId)
    );
    const nextIndex =
      (currentIndex + step + decadalOptions.length) % decadalOptions.length;
    const nextId = decadalOptions[nextIndex].id;
    setCurrentDecadalId(nextId);
    setSelectedDecadalIds((prev) =>
      prev.includes(nextId) ? prev : [...prev, nextId]
    );
  };

  const shiftYear = (step: number) => {
    if (yearOptions.length === 0) return;
    const currentIndex = Math.max(0, yearOptions.indexOf(currentYear ?? 0));
    const nextIndex =
      (currentIndex + step + yearOptions.length) % yearOptions.length;
    const nextYear = yearOptions[nextIndex];
    setCurrentYear(nextYear);
    setSelectedYears((prev) =>
      prev.includes(nextYear) ? prev : [...prev, nextYear]
    );
  };

  const shiftMonth = (step: number) => {
    if (monthOptions.length === 0) return;
    const currentIndex = Math.max(
      0,
      monthOptions.findIndex((item) => item.key === currentMonthKey)
    );
    const nextIndex =
      (currentIndex + step + monthOptions.length) % monthOptions.length;
    const nextKey = monthOptions[nextIndex].key;
    setCurrentMonthKey(nextKey);
    setSelectedMonthKeys((prev) =>
      prev.includes(nextKey) ? prev : [...prev, nextKey]
    );
  };

  const shiftDay = (step: number) => {
    if (dayOptions.length === 0) return;
    const currentIndex = Math.max(
      0,
      dayOptions.findIndex((item) => item.key === currentDayKey)
    );
    const nextIndex =
      (currentIndex + step + dayOptions.length) % dayOptions.length;
    const nextKey = dayOptions[nextIndex].key;
    setCurrentDayKey(nextKey);
    setSelectedDayKeys((prev) =>
      prev.includes(nextKey) ? prev : [...prev, nextKey]
    );
  };

  const refreshCharts = async () => {
    setChartsLoading(true);
    try {
      const res = await fetch("/api/charts");
      if (!res.ok) return;
      const data = await res.json();
      setCharts(Array.isArray(data.charts) ? data.charts : []);
    } finally {
      setChartsLoading(false);
    }
  };

  const applyChart = (chart: SavedChart) => {
    // 切换星盘时，把表单和盘面一起恢复，用户能立即看到结果
    setForm(chart.form);
    setPanelInput(chart.input);
    setResult(chart.result ?? null);
    // 选择历史星盘时重新走接口，确保与后端计算保持一致
    void loadFromApi(chart.input);
    setError(null);
    setSaveMessage(null);
  };
  const loadFromApi = async (input: PanelInput) => {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H1",
        location: "src/app/pan/page.tsx:loadFromApi:entry",
        message: "loadFromApi called",
        data: { date: input.date, timeIndex: input.timeIndex, gender: input.gender },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log

    const res = await fetch("/api/ziwei/natal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H2",
        location: "src/app/pan/page.tsx:loadFromApi:response",
        message: "natal response received",
        data: { status: res.status, ok: res.ok },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log

    const text = await res.clone().text();
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H3",
        location: "src/app/pan/page.tsx:loadFromApi:body",
        message: "natal response body size",
        data: { length: text.length, preview: text.slice(0, 80) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log

    const data = (await res.json()) as NatalApiResponse | { error?: string };
    if (!res.ok) {
      throw new Error((data as { error?: string })?.error || "排盘失败");
    }
    // 类型断言：确保 data 是成功的响应
    const responseData = data as NatalApiResponse;
    
    // 打印接口输出的内容，方便观察和调试
    // 说明：这是从后端 API (/api/ziwei/natal) 返回的完整数据
    console.log("\n========== 【前端】接口排盘 API 响应数据 ==========");
    console.log("📥 数据来源：后端 API 接口 /api/ziwei/natal");
    console.log("📋 请求参数：", JSON.stringify(input, null, 2));
    console.log("\n【1️⃣ 映射后的简化数据】这是经过 mapper 处理后的结构化数据，用于前端展示：");
    console.log(JSON.stringify({
      solarBirthDate: responseData.solarBirthDate,
      lunarBirthDate: responseData.lunarBirthDate,
      wuxingju: responseData.wuxingju,
      mingzhu: responseData.mingzhu,
      shenzhu: responseData.shenzhu,
      palaces: responseData.palaces,
    }, null, 2));
    console.log("\n【2️⃣ 原始星盘数据 (rawAstrolabe)】这是 iztro 库生成的完整星盘对象，包含所有宫位、星曜等详细信息：");
    console.log(JSON.stringify(responseData.rawAstrolabe, null, 2));
    console.log("\n【3️⃣ 原始运限数据 (rawHoroscope)】这是当前运限（大限/流年等）的完整数据：");
    console.log(JSON.stringify(responseData.rawHoroscope, null, 2));
    console.log("\n【4️⃣ 运限时间信息】");
    console.log("  - horoscopeDate:", responseData.horoscopeDate);
    console.log("  - horoscopeHour:", responseData.horoscopeHour);
    console.log("===========================================\n");
    
    setPanelInput(input);
    setResult(responseData);
    setRawAstrolabe(responseData.rawAstrolabe);
    setRawHoroscope(responseData.rawHoroscope);
    setHoroscopeDate(new Date(responseData.horoscopeDate));
    setHoroscopeHour(responseData.horoscopeHour);
  };

  const horoscopeInFlightRef = useRef<Promise<any> | null>(null);
  const horoscopePendingRef = useRef<{ date: Date; hour: number } | null>(null);
  const horoscopeRateLimitUntilRef = useRef<number | null>(null);

  const runFetchHoroscope = async (date: Date, hour: number) => {
    if (!panelInput) return null;
    const res = await fetch("/api/ziwei/horoscope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...panelInput,
        targetDate: date.toISOString(),
        targetHour: hour,
      }),
    });
    const text = await res.clone().text();
    const data = await res.json();
    if (!res.ok) {
      const resetAt =
        typeof data?.resetAt === "number" ? data.resetAt : undefined;
      if (res.status === 429 && resetAt) {
        horoscopeRateLimitUntilRef.current = resetAt;
      }
      throw new Error(data?.error || "运限计算失败");
    }
    setRawHoroscope(data.rawHoroscope);
    setHoroscopeDate(date);
    setHoroscopeHour(hour);
    return data.rawHoroscope;
  };

  const fetchHoroscope = async (date: Date, hour: number) => {
    if (!panelInput) return null;
    const rateLimitUntil = horoscopeRateLimitUntilRef.current;
    if (rateLimitUntil && Date.now() < rateLimitUntil) {
      const secondsLeft = Math.max(
        1,
        Math.ceil((rateLimitUntil - Date.now()) / 1000)
      );
      setError(`请求过于频繁，请约 ${secondsLeft} 秒后再试`);
      return null;
    }
    if (horoscopeInFlightRef.current) {
      // 已有请求在进行中，先记录最新点击，避免频繁请求导致 429
      horoscopePendingRef.current = { date, hour };
      return horoscopeInFlightRef.current;
    }

    setHoroscopeLoading(true);
    setError(null);
    const task = (async () => {
      try {
        return await runFetchHoroscope(date, hour);
      } catch (err) {
        setError(err instanceof Error ? err.message : "运限计算失败");
        throw err;
      } finally {
        setHoroscopeLoading(false);
        horoscopeInFlightRef.current = null;
        if (horoscopePendingRef.current) {
          const rateLimitUntilNext = horoscopeRateLimitUntilRef.current;
          if (rateLimitUntilNext && Date.now() < rateLimitUntilNext) {
            // 当前仍在限流窗口内，不自动触发下一次请求，避免连续 429
            return;
          }
          const next = horoscopePendingRef.current;
          horoscopePendingRef.current = null;
          void fetchHoroscope(next.date, next.hour);
        }
      }
    })();
    horoscopeInFlightRef.current = task;
    return task;
  };

  const fetchHoroscopeRaw = async (date: Date) => {
    if (!panelInput) return null;
    const res = await fetch("/api/ziwei/horoscope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...panelInput,
        targetDate: date.toISOString(),
        targetHour: horoscopeHour,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "运限计算失败");
    }
    return data.rawHoroscope;
  };

  const buildDateForYear = (year: number) => {
    // 用生日的月/日作为锚点，确保年龄落在该年的正确区间（避免大限错位）
    const [_, monthText, dayText] = form.birthday?.split("-") ?? [];
    const month = Number(monthText);
    const day = Number(dayText);
    if (!month || !day) {
      // 生日缺失时回退到 1 月 1 日
      return new Date(year, 0, 1);
    }
    const candidate = new Date(year, month - 1, day);
    // 处理 2/29 这类非闰年日期，回退到当月最后一天
    if (candidate.getMonth() !== month - 1) {
      return new Date(year, month, 0);
    }
    return candidate;
  };


  const onSendCode = async () => {
    setAuthError(null);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data?.error || "登录失败");
        return;
      }
      setSaveMessage("验证码已发送，请查收邮箱");
    } catch {
      setAuthError("发送失败，请稍后重试");
    }
  };

  const onVerifyCode = async () => {
    setAuthError(null);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput, code: codeInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data?.error || "验证码无效");
        return;
      }
      setUserEmail(data.email);
      setCodeInput("");
      await refreshCharts();
    } catch {
      setAuthError("验证失败，请稍后重试");
    }
  };

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    setUserEmail(null);
    setCharts([]);
    setSelectedChartId("");
    setSaveMessage("已退出登录");
  };

  const onSaveChart = async () => {
    setSaveMessage(null);
    if (!userEmail) {
      setSaveMessage("请先登录邮箱后再保存");
      return;
    }
    if (!panelInput || !result) {
      setSaveMessage("请先生成星盘，再点击保存");
      return;
    }
    try {
      const res = await fetch("/api/charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form,
          input: panelInput,
          result,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(data?.error || "保存失败");
        return;
      }
      setSaveMessage("保存成功");
      await refreshCharts();
      setSelectedChartId(data.chart?.id ?? "");
    } catch {
      setSaveMessage("保存失败，请稍后重试");
    }
  };

  // 生成星盘 JSON 并保存到文件
  const onGenerateLLMJson = async () => {
    setSaveMessage(null);
    if (!rawAstrolabe) {
      setSaveMessage("请先生成星盘，再点击生成 JSON");
      return;
    }
    try {
      // 调用转换函数生成 LLM 格式的 JSON
      const llmPayload = generateLLMPayload(rawAstrolabe, rawHoroscope, form, {
        // 星盘 JSON 需要保留当前运限切片
        includeCurrentTimeSlice: true,
      });
      
      // 保存到后端
      const res = await fetch("/api/llm-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(llmPayload),
      });
      
      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(data?.error || "保存 JSON 失败");
        return;
      }
      
      setSaveMessage(`JSON 文件已保存：${data.fileName}`);
    } catch (error) {
      console.error("生成 LLM JSON 失败:", error);
      setSaveMessage(
        error instanceof Error ? error.message : "生成 JSON 失败，请稍后重试"
      );
    }
  };

  const onGenerateHoroscopeJson = async (options?: {
    allowEmptySelection?: boolean;
    fileBaseName?: string;
    silentSuccess?: boolean;
  }) => {
    setSaveMessage(null);
    if (!rawAstrolabe || !rawHoroscope) {
      setSaveMessage("请先生成星盘，再点击生成运势 JSON");
      return null;
    }

    setHoroscopeJsonLoading(true);
    try {
      const payload = await buildSelectedHoroscopePayload({
        allowEmptySelection: options?.allowEmptySelection,
      });
      if (!payload) return null;

      const res = await fetch("/api/llm-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          fileBaseName: options?.fileBaseName ?? getManualFortuneFileBaseName(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(data?.error || "保存 JSON 失败");
        return null;
      }

      if (!options?.silentSuccess) {
        setSaveMessage(`运势 JSON 文件已保存：${data.fileName}`);
      }
      return { fileName: data.fileName as string };
    } catch (error) {
      console.error("生成运势 JSON 失败:", error);
      setSaveMessage(
        error instanceof Error ? error.message : "生成 JSON 失败，请稍后重试"
      );
      return null;
    } finally {
      setHoroscopeJsonLoading(false);
    }
  };

  const onGenerateHoroscopeText = async () => {
    setSaveMessage(null);
    if (!rawAstrolabe || !rawHoroscope) {
      setSaveMessage("请先生成星盘，再点击生成运势文本");
      return;
    }

    setHoroscopeTextLoading(true);
    try {
      const payload = await buildSelectedHoroscopePayload();
      if (!payload) return;

      const content = serializeHoroscopeText(payload);
      const res = await fetch("/api/llm-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          fileBaseName: getManualFortuneFileBaseName(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(data?.error || "保存文本失败");
        return;
      }

      setSaveMessage(`运势文本文件已保存：${data.fileName}`);
    } catch (error) {
      console.error("生成运势文本失败:", error);
      setSaveMessage(
        error instanceof Error ? error.message : "生成文本失败，请稍后重试"
      );
    } finally {
      setHoroscopeTextLoading(false);
    }
  };

  const onOpenAiChat = async () => {
    if (exportBusy) return;
    if (!rawAstrolabe || !rawHoroscope) {
      setSaveMessage("请先生成星盘，再点击 AI问命");
      return;
    }
    setAiLaunching(true);
    try {
      // 文件名规则：用户姓名 + 今日日期（MMDD），例如 zoe0302
      const fileBaseName = `${normalizeNameForFile(form.name || "user")}${formatTodayMMDD()}`;
      const generated = await onGenerateHoroscopeJson({
        allowEmptySelection: true,
        fileBaseName,
        silentSuccess: true,
      });
      if (!generated?.fileName) return;
      setSaveMessage(`已生成运势 JSON：${generated.fileName}，正在打开 AI 问命页面`);
      const url = `/ai-chat?fileName=${encodeURIComponent(generated.fileName)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setAiLaunching(false);
    }
  };

  const getManualFortuneFileBaseName = () => {
    if (manualFortuneFileBaseName) {
      return manualFortuneFileBaseName;
    }
    const nextBaseName = buildFortuneFileBaseName(form.name || "user");
    setManualFortuneFileBaseName(nextBaseName);
    return nextBaseName;
  };

  const getBackendFortuneFileBaseName = () => {
    if (backendFortuneFileBaseName) {
      return backendFortuneFileBaseName;
    }
    const nextBaseName = buildFortuneFileBaseName(form.name || "user");
    setBackendFortuneFileBaseName(nextBaseName);
    return nextBaseName;
  };

  const buildBackendHoroscopeExportRequest = (options?: {
    allowEmptySelection?: boolean;
    fileBaseName?: string;
  }): BackendHoroscopeExportRequest | null => {
    if (!panelInput) {
      return null;
    }

    const allowedYears = getAllowedYearsFromDecadals(selectedDecadalIds);
    const selectedDecades = [...selectedDecadalIds]
      .map((id) => decadalOptions.find((item) => item.id === id))
      .filter((item): item is DecadalOption => Boolean(item))
      .sort((a, b) => a.startAge - b.startAge)
      .map((item) => ({
        startAge: item.startAge,
        endAge: item.endAge,
      }));

    const finalYears =
      allowedYears.length === 0
        ? []
        : Array.from(new Set(selectedYears))
            .filter((year) => allowedYears.includes(year))
            .sort((a, b) => a - b);
    const yearSet = new Set(finalYears);

    const finalMonths = Array.from(
      new Map(
        selectedMonthKeys
          .filter((key) => yearSet.has(Number(key.split("-")[0])))
          .map((key) => {
            const [yearText, monthText] = key.split("-");
            const year = Number(yearText);
            const month = Number(monthText);
            return [key, { year, month }] as const;
          })
          .filter(([, value]) => value.year > 0 && value.month > 0)
      ).values()
    ).sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
    const monthSet = new Set(
      finalMonths.map((item) => buildMonthKey(item.year, item.month))
    );

    const finalDays = Array.from(
      new Map(
        selectedDayKeys
          .filter((key) => {
            const [yearText, monthText] = key.split("-");
            return monthSet.has(buildMonthKey(Number(yearText), Number(monthText)));
          })
          .map((key) => {
            const [yearText, monthText, dayText] = key.split("-");
            const year = Number(yearText);
            const month = Number(monthText);
            const day = Number(dayText);
            return [key, { year, month, day }] as const;
          })
          .filter(([, value]) => value.year > 0 && value.month > 0 && value.day > 0)
      ).values()
    ).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.month !== b.month) return a.month - b.month;
      return a.day - b.day;
    });

    const hasSelection =
      selectedDecades.length > 0 ||
      finalYears.length > 0 ||
      finalMonths.length > 0 ||
      finalDays.length > 0;
    if (!hasSelection && !options?.allowEmptySelection) {
      setSaveMessage("请先选择至少一个大限 / 流年 / 流月 / 流日");
      return null;
    }

    return {
      ...panelInput,
      fileBaseName: options?.fileBaseName ?? getBackendFortuneFileBaseName(),
      allowEmptySelection: options?.allowEmptySelection,
      selected_decades: selectedDecades,
      selected_years: finalYears,
      selected_months: finalMonths,
      selected_days: finalDays,
    };
  };

  const onGenerateBackendHoroscopeJson = async () => {
    setSaveMessage(null);
    if (!panelInput) {
      setSaveMessage("请先生成星盘，再点击后端生成运势 JSON");
      return;
    }

    setBackendHoroscopeJsonLoading(true);
    try {
      const requestBody = buildBackendHoroscopeExportRequest();
      if (!requestBody) return;

      const res = await fetch("/api/ziwei/export-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(data?.error || "后端生成 JSON 失败");
        return;
      }
      setSaveMessage(`后端运势 JSON 文件已保存：${data.fileName}`);
    } catch (error) {
      console.error("后端生成运势 JSON 失败:", error);
      setSaveMessage(
        error instanceof Error ? error.message : "后端生成 JSON 失败，请稍后重试"
      );
    } finally {
      setBackendHoroscopeJsonLoading(false);
    }
  };

  const onGenerateBackendHoroscopeText = async () => {
    setSaveMessage(null);
    if (!panelInput) {
      setSaveMessage("请先生成星盘，再点击后端生成运势文本");
      return;
    }

    setBackendHoroscopeTextLoading(true);
    try {
      const requestBody = buildBackendHoroscopeExportRequest();
      if (!requestBody) return;

      const res = await fetch("/api/ziwei/export-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(data?.error || "后端生成文本失败");
        return;
      }
      setSaveMessage(`后端运势文本文件已保存：${data.fileName}`);
    } catch (error) {
      console.error("后端生成运势文本失败:", error);
      setSaveMessage(
        error instanceof Error ? error.message : "后端生成文本失败，请稍后重试"
      );
    } finally {
      setBackendHoroscopeTextLoading(false);
    }
  };

  const buildSelectedHoroscopePayload = async (options?: {
    allowEmptySelection?: boolean;
  }) => {
    if (!rawAstrolabe || !rawHoroscope) {
      return null;
    }

    const allowedYears = getAllowedYearsFromDecadals(selectedDecadalIds);
    const finalDecadalIds = selectedDecadalIds;
    const finalYears =
      allowedYears.length === 0
        ? []
        : selectedYears.filter((year) => allowedYears.includes(year));
    const yearSet = new Set(finalYears);
    const finalMonthKeys = selectedMonthKeys.filter((key) =>
      yearSet.has(Number(key.split("-")[0]))
    );
    const monthSet = new Set(finalMonthKeys);
    const finalDayKeys = selectedDayKeys.filter((key) => {
      const [yearText, monthText] = key.split("-");
      return monthSet.has(buildMonthKey(Number(yearText), Number(monthText)));
    });

    if (
      finalDecadalIds.length === 0 &&
      finalYears.length === 0 &&
      finalMonthKeys.length === 0 &&
      finalDayKeys.length === 0 &&
      !options?.allowEmptySelection
    ) {
      setSaveMessage("请先选择至少一个大限 / 流年 / 流月 / 流日");
      return null;
    }

    const basePayload = generateLLMPayload(rawAstrolabe, rawHoroscope, form, {
      includeCurrentTimeSlice: false,
    });

    const selectedSlices = {
      decades: [] as Array<Record<string, unknown>>,
      years: [] as Array<Record<string, unknown>>,
      months: [] as Array<Record<string, unknown>>,
      days: [] as Array<Record<string, unknown>>,
    };

    const sortedDecadalIds = [...finalDecadalIds].sort((a, b) => {
      const aStart = Number(a.split("-")[0]);
      const bStart = Number(b.split("-")[0]);
      if (Number.isNaN(aStart) || Number.isNaN(bStart)) return 0;
      return aStart - bStart;
    });

    for (const id of sortedDecadalIds) {
      const option = decadalOptions.find((item) => item.id === id);
      if (!option) continue;
      const targetYear =
        birthYear != null
          ? birthYear + option.startAge
          : currentYear ?? new Date().getFullYear();
      const horoscope = await fetchHoroscopeRaw(buildDateForYear(targetYear));
      if (!horoscope) continue;
      selectedSlices.decades.push({
        label: `${option.label} ${option.subLabel}`.trim(),
        start_age: option.startAge,
        end_age: option.endAge,
        target_year: targetYear,
        slice: buildHoroscopeSlice(rawAstrolabe, horoscope, {
          includeDecade: true,
          includeYear: false,
          includeMonth: false,
          includeDay: false,
        }),
      });
    }

    const uniqueYears = Array.from(new Set(finalYears)).sort((a, b) => a - b);
    for (const year of uniqueYears) {
      const isCurrentYear = horoscopeDate && year === horoscopeDate.getFullYear();
      const horoscope = isCurrentYear
        ? rawHoroscope
        : await fetchHoroscopeRaw(buildDateForYear(year));
      if (!horoscope) continue;
      selectedSlices.years.push({
        label: `${year}年`,
        year,
        slice: buildHoroscopeSlice(rawAstrolabe, horoscope, {
          includeDecade: false,
          includeYear: true,
          includeMonth: false,
          includeDay: false,
        }),
      });
    }

    const uniqueMonths = Array.from(new Set(finalMonthKeys)).sort((a, b) => {
      const [ay, am] = a.split("-").map(Number);
      const [by, bm] = b.split("-").map(Number);
      if (ay !== by) return ay - by;
      return am - bm;
    });
    for (const key of uniqueMonths) {
      const [yearText, monthText] = key.split("-");
      const year = Number(yearText);
      const month = Number(monthText);
      if (!year || !month) continue;
      const isCurrentMonth =
        horoscopeDate &&
        year === horoscopeDate.getFullYear() &&
        month === horoscopeDate.getMonth() + 1;
      const horoscope = isCurrentMonth
        ? rawHoroscope
        : await fetchHoroscopeRaw(new Date(year, month - 1, 1));
      if (!horoscope) continue;
      selectedSlices.months.push({
        label: `${year}年${month}月`,
        year,
        month,
        slice: buildHoroscopeSlice(rawAstrolabe, horoscope, {
          includeDecade: false,
          includeYear: false,
          includeMonth: true,
          includeDay: false,
        }),
      });
    }

    const uniqueDays = Array.from(new Set(finalDayKeys)).sort((a, b) => {
      const [ay, am, ad] = a.split("-").map(Number);
      const [by, bm, bd] = b.split("-").map(Number);
      if (ay !== by) return ay - by;
      if (am !== bm) return am - bm;
      return ad - bd;
    });
    for (const key of uniqueDays) {
      const [yearText, monthText, dayText] = key.split("-");
      const year = Number(yearText);
      const month = Number(monthText);
      const day = Number(dayText);
      if (!year || !month || !day) continue;
      const isCurrentDay =
        horoscopeDate &&
        year === horoscopeDate.getFullYear() &&
        month === horoscopeDate.getMonth() + 1 &&
        day === horoscopeDate.getDate();
      const horoscope = isCurrentDay
        ? rawHoroscope
        : await fetchHoroscopeRaw(new Date(year, month - 1, day));
      if (!horoscope) continue;
      selectedSlices.days.push({
        label: `${year}年${month}月${day}日`,
        year,
        month,
        day,
        slice: buildHoroscopeSlice(rawAstrolabe, horoscope, {
          includeDecade: false,
          includeYear: false,
          includeMonth: false,
          includeDay: true,
        }),
      });
    }

    return {
      ...basePayload,
      selected_time_slices: selectedSlices,
    };
  };

  const closePicker = () => setOpenPicker(null);

  const confirmDecadalPicker = () => {
    const allowedYears = getAllowedYearsFromDecadals(pendingDecadalIds);
    setSelectedDecadalIds(pendingDecadalIds);
    // 大限变化时，清理不在大限范围内的流年/流月
    setSelectedYears((prev) => prev.filter((year) => allowedYears.includes(year)));
    setSelectedMonthKeys((prev) => {
      const nextMonths = prev.filter((key) =>
        allowedYears.includes(Number(key.split("-")[0]))
      );
      const monthSet = new Set(nextMonths);
      // 同步清理不在可用流月内的流日，避免导出脏数据
      setSelectedDayKeys((dayPrev) =>
        dayPrev.filter((key) => {
          const [yearText, monthText] = key.split("-");
          return monthSet.has(buildMonthKey(Number(yearText), Number(monthText)));
        })
      );
      return nextMonths;
    });
    closePicker();
  };

  const confirmYearlyPicker = () => {
    const allowedYears = getAllowedYearsFromDecadals(selectedDecadalIds);
    const nextYears =
      allowedYears.length === 0
        ? []
        : pendingYears.filter((year) => allowedYears.includes(year));
    setSelectedYears(nextYears);
    // 若选择年变化，清理不在年份范围内的流月
    setSelectedMonthKeys((prev) => {
      const nextMonths = prev.filter((key) =>
        nextYears.includes(Number(key.split("-")[0]))
      );
      const monthSet = new Set(nextMonths);
      setSelectedDayKeys((dayPrev) =>
        dayPrev.filter((key) => {
          const [yearText, monthText] = key.split("-");
          return monthSet.has(buildMonthKey(Number(yearText), Number(monthText)));
        })
      );
      return nextMonths;
    });
    closePicker();
  };

  const confirmMonthlyPicker = () => {
    const yearSet = new Set(selectedYears);
    const nextMonths = pendingMonthKeys.filter((key) =>
      yearSet.has(Number(key.split("-")[0]))
    );
    setSelectedMonthKeys(nextMonths);
    const monthSet = new Set(nextMonths);
    setSelectedDayKeys((prev) =>
      prev.filter((key) => {
        const [yearText, monthText] = key.split("-");
        return monthSet.has(buildMonthKey(Number(yearText), Number(monthText)));
      })
    );
    closePicker();
  };

  const confirmDailyPicker = () => {
    const monthSet = new Set(selectedMonthKeys);
    setSelectedDayKeys(
      pendingDayKeys.filter((key) => {
        const [yearText, monthText] = key.split("-");
        return monthSet.has(buildMonthKey(Number(yearText), Number(monthText)));
      })
    );
    closePicker();
  };

  const onSubmit = () => {
    setLoading(true);
    setError(null);
    setSaveMessage(null);
    if (!form.birthday || !form.birthTime) {
      setError("请填写出生日期与出生时辰");
      setLoading(false);
      return;
    }
    const payload: PanelInput = {
      calendar: "solar",
      date: toApiDate(form.birthday),
      timeIndex,
      gender: form.gender,
      fixLeap: true,
      isLeapMonth: false,
      language: "zh-CN",
    };
    loadFromApi(payload)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "排盘失败，请稍后重试");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <PanShell active="api">
      <div className={styles.page}>
        <div className={styles.container}>
          <header className={styles.hero}>
            <div>
              <h1 className={styles.serif}>接口排盘</h1>
              <p>排盘计算在后端完成，前端只展示结果。</p>
            </div>
          </header>

          <div className={styles.layout}>
            <section className={styles.card}>
              <h2 className={styles.serif}>输入信息</h2>
            <div className={styles.authBlock}>
              <div className={styles.authRow}>
                <label className={styles.field}>
                  登录邮箱
                  <input
                    className={styles.input}
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="用于保存星盘记录"
                  />
                </label>
                <div className={styles.authActions}>
                  {userEmail ? (
                    <>
                      <span className={styles.muted}>已登录：{userEmail}</span>
                      <button
                        className={styles.secondaryButton}
                        onClick={onLogout}
                        type="button"
                      >
                        退出
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className={styles.secondaryButton}
                        onClick={onSendCode}
                        type="button"
                        disabled={!emailInput}
                      >
                        发送验证码
                      </button>
                      <label className={styles.codeField}>
                        验证码
                        <input
                          className={styles.input}
                          value={codeInput}
                          onChange={(e) => setCodeInput(e.target.value)}
                          placeholder="6位数字"
                        />
                      </label>
                      <button
                        className={styles.secondaryButton}
                        onClick={onVerifyCode}
                        type="button"
                        disabled={!emailInput || codeInput.length !== 6}
                      >
                        验证登录
                      </button>
                    </>
                  )}
                </div>
              </div>
              {authError && <p className={styles.error}>{authError}</p>}
              <p className={styles.note}>
                说明：系统会向邮箱发送验证码，用于验证登录身份。
                测试时也可直接输入默认验证码 123456 快速登录。
              </p>
            </div>

            <div className={styles.chartList}>
              <label className={styles.field}>
                已保存星盘
                <select
                  className={styles.input}
                  value={selectedChartId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedChartId(nextId);
                    const match = charts.find((item) => item.id === nextId);
                    if (match) {
                      applyChart(match);
                    }
                  }}
                  disabled={!userEmail || chartsLoading || charts.length === 0}
                >
                  <option value="">
                    {chartsLoading
                      ? "加载中..."
                      : charts.length === 0
                        ? "暂无保存记录"
                        : "请选择"}
                  </option>
                  {charts.map((chart) => (
                    <option key={chart.id} value={chart.id}>
                      {(chart.form.name || "未命名") +
                        " · " +
                        chart.form.birthday +
                        " " +
                        chart.form.birthTime}
                    </option>
                  ))}
                </select>
              </label>
              <p className={styles.note}>
                说明：登录后可以保存多个星盘，并在这里切换查看。
              </p>
            </div>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                姓名（可不填）
                <input
                  className={styles.input}
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="不填也可排盘"
                />
              </label>
              <label className={styles.field}>
                性别
                <select
                  className={styles.input}
                  value={form.gender}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      gender: e.target.value as FormState["gender"],
                    }))
                  }
                >
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </label>
              <label className={styles.field}>
                出生日期（阳历）
                <input
                  className={styles.input}
                  type="date"
                  value={form.birthday}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, birthday: e.target.value }))
                  }
                />
              </label>
              <label className={styles.field}>
                出生时辰（可精确到分钟）
                <input
                  className={styles.input}
                  type="time"
                  step={60}
                  value={form.birthTime}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, birthTime: e.target.value }))
                  }
                />
                <span className={styles.note}>
                  自动换算时辰：{timeLabel || "—"}
                </span>
              </label>
              <label className={styles.field}>
                出生地点
                <input
                  className={styles.input}
                  value={form.birthplace}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, birthplace: e.target.value }))
                  }
                  placeholder="城市或具体地点"
                />
              </label>
            </div>
            <div className={styles.buttonRow}>
              <button
                className={styles.button}
                onClick={onSubmit}
                disabled={loading}
              >
                {loading ? "排盘中..." : "开始排盘"}
              </button>
              <button
                className={styles.secondaryButton}
                onClick={onSaveChart}
                type="button"
                disabled={!panelInput}
              >
                保存当前星盘
              </button>
              <button
                className={styles.secondaryButton}
                onClick={onGenerateLLMJson}
                type="button"
                disabled={!rawAstrolabe}
              >
                生成星盘JSON
              </button>
            </div>
            {error && <p className={styles.error}>{error}</p>}
            {saveMessage && <p className={styles.note}>{saveMessage}</p>}
            <p className={styles.helper}>
              说明：紫微斗数以阳历为准，本页面将出生时分自动映射到对应时辰。
            </p>
            </section>

            <section className={`${styles.card} ${styles.resultCard}`}>
              <div className={styles.resultHeader}>
                <h2 className={styles.serif}>紫微斗数排盘结果</h2>
                {result && (
                  <div className={styles.meta}>
                    <span>姓名：{form.name || "未填写"}</span>
                    <span>出生地：{form.birthplace || "未填写"}</span>
                    <span>
                      阳历：{form.birthday} {form.birthTime}
                    </span>
                  </div>
                )}
              </div>

            {rawAstrolabe && rawHoroscope && horoscopeDate ? (
              <div className={styles.astrolabeSection}>
                <div className={styles.astrolabeWrap}>
                  <IztrolabeServer
                    astrolabe={rawAstrolabe}
                    horoscope={rawHoroscope}
                    horoscopeDate={horoscopeDate}
                    horoscopeHour={horoscopeHour}
                    centerPalaceAlign
                    onHoroscopeChange={fetchHoroscope}
                  />
                </div>
                <div className={styles.horoscopePanel}>
                  <div className={styles.pickerRow}>
                    <span className={styles.pickerLabel}>大限</span>
                    <div className={styles.pickerNav}>
                      <button
                        className={styles.pickerArrow}
                        type="button"
                        onClick={() => shiftDecadal(-1)}
                        aria-label="上一大限"
                      >
                        ‹
                      </button>
                      <button
                        className={styles.pickerValue}
                        type="button"
                        onClick={openDecadalPicker}
                      >
                        <span>{currentDecadalOption?.label || "未选择"}</span>
                        <span className={styles.pickerSub}>
                          {currentDecadalOption?.subLabel || "点击选择多个"}
                        </span>
                      </button>
                      <button
                        className={styles.pickerArrow}
                        type="button"
                        onClick={() => shiftDecadal(1)}
                        aria-label="下一大限"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                  <div className={styles.pickerRow}>
                    <span className={styles.pickerLabel}>流年</span>
                    <div className={styles.pickerNav}>
                      <button
                        className={styles.pickerArrow}
                        type="button"
                        onClick={() => shiftYear(-1)}
                        aria-label="上一年"
                      >
                        ‹
                      </button>
                      <button
                        className={styles.pickerValue}
                        type="button"
                        onClick={openYearlyPicker}
                      >
                        <span>{currentYear ? `${currentYear}年` : "未选择"}</span>
                        <span className={styles.pickerSub}>点击选择多个</span>
                      </button>
                      <button
                        className={styles.pickerArrow}
                        type="button"
                        onClick={() => shiftYear(1)}
                        aria-label="下一年"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                  <div className={styles.pickerRow}>
                    <span className={styles.pickerLabel}>流月</span>
                    <div className={styles.pickerNav}>
                      <button
                        className={styles.pickerArrow}
                        type="button"
                        onClick={() => shiftMonth(-1)}
                        aria-label="上一月"
                      >
                        ‹
                      </button>
                      <button
                        className={styles.pickerValue}
                        type="button"
                        onClick={openMonthlyPicker}
                      >
                        <span>{currentMonthOption?.label || "未选择"}</span>
                        <span className={styles.pickerSub}>点击选择多个</span>
                      </button>
                      <button
                        className={styles.pickerArrow}
                        type="button"
                        onClick={() => shiftMonth(1)}
                        aria-label="下一月"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                  <div className={styles.pickerRow}>
                    <span className={styles.pickerLabel}>流日</span>
                    <div className={styles.pickerNav}>
                      <button
                        className={styles.pickerArrow}
                        type="button"
                        onClick={() => shiftDay(-1)}
                        aria-label="上一日"
                      >
                        ‹
                      </button>
                      <button
                        className={styles.pickerValue}
                        type="button"
                        onClick={openDailyPicker}
                      >
                        <span>{currentDayOption?.label || "未选择"}</span>
                        <span className={styles.pickerSub}>点击选择多个</span>
                      </button>
                      <button
                        className={styles.pickerArrow}
                        type="button"
                        onClick={() => shiftDay(1)}
                        aria-label="下一日"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                  <div className={styles.horoscopeActions}>
                    <button
                      className={styles.button}
                      type="button"
                      onClick={() => {
                        void onGenerateHoroscopeJson();
                      }}
                      disabled={exportBusy || !rawAstrolabe}
                    >
                      {horoscopeJsonLoading ? "生成中..." : "生成运势JSON"}
                    </button>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={onGenerateHoroscopeText}
                      disabled={exportBusy || !rawAstrolabe}
                    >
                      {horoscopeTextLoading ? "生成中..." : "生成运势文本"}
                    </button>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={onOpenAiChat}
                      disabled={exportBusy || !rawAstrolabe}
                    >
                      {aiLaunching ? "打开中..." : "AI问命"}
                    </button>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={onGenerateBackendHoroscopeJson}
                      disabled={backendExportBusy || !panelInput}
                    >
                      {backendHoroscopeJsonLoading ? "生成中..." : "后端生成JSON"}
                    </button>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={onGenerateBackendHoroscopeText}
                      disabled={backendExportBusy || !panelInput}
                    >
                      {backendHoroscopeTextLoading ? "生成中..." : "后端生成文本"}
                    </button>
                    <p className={styles.note}>
                    说明：前 3 个按钮沿用前端生成，后 2 个按钮用于验证后端生成；只会生成已选择的大限 / 流年 / 流月 / 流日，各层可按需选择。
                    </p>
                  </div>
                </div>
              </div>
            ) : (
                <div className={styles.placeholder}>
                  请先填写出生信息并点击“开始排盘”
                </div>
              )}
            </section>
          </div>
        </div>
        {openPicker === "decadal" && (
          <div className={styles.pickerOverlay} onClick={closePicker}>
            <div
              className={styles.pickerDialog}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className={styles.pickerHeader}>
                <h3 className={styles.serif}>选择大限</h3>
                <p className={styles.note}>可多选，点击卡片即可切换</p>
              </div>
              <div className={styles.pickerGrid}>
                {decadalOptions.map((option) => {
                  const active = pendingDecadalIds.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`${styles.pickerCard} ${
                        active ? styles.pickerCardActive : ""
                      }`}
                      onClick={() =>
                        setPendingDecadalIds((prev) =>
                          prev.includes(option.id)
                            ? prev.filter((id) => id !== option.id)
                            : [...prev, option.id]
                        )
                      }
                    >
                      <span className={styles.pickerCardMain}>
                        {option.label}
                      </span>
                      <span className={styles.pickerCardSub}>
                        {option.subLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.pickerActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={closePicker}
                >
                  取消
                </button>
                <button
                  className={styles.button}
                  type="button"
                  onClick={confirmDecadalPicker}
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        )}
        {openPicker === "yearly" && (
          <div className={styles.pickerOverlay} onClick={closePicker}>
            <div
              className={styles.pickerDialog}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className={styles.pickerHeader}>
                <h3 className={styles.serif}>选择流年</h3>
                <p className={styles.note}>可多选，点击年份即可切换</p>
              </div>
              <div className={styles.pickerGrid}>
                {yearOptions.length === 0 ? (
                  <div className={styles.pickerEmpty}>请先选择大限</div>
                ) : (
                  yearOptions.map((year) => {
                    const active = pendingYears.includes(year);
                    return (
                      <button
                        key={year}
                        type="button"
                        className={`${styles.pickerCard} ${
                          active ? styles.pickerCardActive : ""
                        }`}
                        onClick={() =>
                          setPendingYears((prev) =>
                            prev.includes(year)
                              ? prev.filter((item) => item !== year)
                              : [...prev, year]
                          )
                        }
                      >
                        <span className={styles.pickerCardMain}>{year}</span>
                        <span className={styles.pickerCardSub}>流年</span>
                      </button>
                    );
                  })
                )}
              </div>
              <div className={styles.pickerActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={closePicker}
                >
                  取消
                </button>
                <button
                  className={styles.button}
                  type="button"
                  onClick={confirmYearlyPicker}
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        )}
        {openPicker === "monthly" && (
          <div className={styles.pickerOverlay} onClick={closePicker}>
            <div
              className={styles.pickerDialog}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className={styles.pickerHeader}>
                <h3 className={styles.serif}>选择流月</h3>
                <p className={styles.note}>
                  可多选（流月基于已选择的年份）
                </p>
              </div>
              <div className={styles.pickerGrid}>
                {monthOptions.length === 0 ? (
                  <div className={styles.pickerEmpty}>请先选择流年</div>
                ) : (
                  monthOptions.map((option) => {
                    const active = pendingMonthKeys.includes(option.key);
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`${styles.pickerCard} ${
                          active ? styles.pickerCardActive : ""
                        }`}
                        onClick={() =>
                          setPendingMonthKeys((prev) =>
                            prev.includes(option.key)
                              ? prev.filter((item) => item !== option.key)
                              : [...prev, option.key]
                          )
                        }
                      >
                        <span className={styles.pickerCardMain}>
                          {option.label}
                        </span>
                        <span className={styles.pickerCardSub}>流月</span>
                      </button>
                    );
                  })
                )}
              </div>
              <div className={styles.pickerActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={closePicker}
                >
                  取消
                </button>
                <button
                  className={styles.button}
                  type="button"
                  onClick={confirmMonthlyPicker}
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        )}
        {openPicker === "daily" && (
          <div className={styles.pickerOverlay} onClick={closePicker}>
            <div
              className={styles.pickerDialog}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className={styles.pickerHeader}>
                <h3 className={styles.serif}>选择流日</h3>
                <p className={styles.note}>
                  可多选（流日基于已选择的流月）
                </p>
              </div>
              <div className={styles.pickerGrid}>
                {dayOptions.length === 0 ? (
                  <div className={styles.pickerEmpty}>请先选择流月</div>
                ) : (
                  dayOptions.map((option) => {
                    const active = pendingDayKeys.includes(option.key);
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`${styles.pickerCard} ${
                          active ? styles.pickerCardActive : ""
                        }`}
                        onClick={() =>
                          setPendingDayKeys((prev) =>
                            prev.includes(option.key)
                              ? prev.filter((item) => item !== option.key)
                              : [...prev, option.key]
                          )
                        }
                      >
                        <span className={styles.pickerCardMain}>
                          {option.label}
                        </span>
                        <span className={styles.pickerCardSub}>流日</span>
                      </button>
                    );
                  })
                )}
              </div>
              <div className={styles.pickerActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={closePicker}
                >
                  取消
                </button>
                <button
                  className={styles.button}
                  type="button"
                  onClick={confirmDailyPicker}
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PanShell>
  );
}
