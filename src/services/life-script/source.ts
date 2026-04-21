import {
  buildHoroscopeExportPayload,
  getDecadalOptions,
  HoroscopeExportSchema,
  normalizeBaseName,
  saveJsonPayload,
  type HoroscopeExportInput,
} from "@/services/horoscopeExport";
import { getNatalAstrolabe } from "@/services/iztro";

function buildTimestampSuffix() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureFortuneBaseName(raw: string | undefined) {
  const normalized = normalizeBaseName(raw);
  if (normalized) {
    return normalized.endsWith("-fortune") ? normalized : `${normalized}-fortune`;
  }
  return `life-script-${buildTimestampSuffix()}-fortune`;
}

function buildLifeScriptBaseName(fortuneBaseName: string) {
  return fortuneBaseName.replace(/-fortune$/, "-life-script");
}

/**
 * 生成 canonical fortune JSON，并固定补齐 9 段大限。
 *
 * 这里故意不依赖页面当前勾选状态，因为人生剧本的产品定义就是完整 decade 曲线。
 * 先把 source fortune 固定下来，后续评分引擎才有稳定“唯一真相输入”。
 */
export async function buildAndSaveLifeScriptSource(
  rawInput: unknown
): Promise<{
  input: HoroscopeExportInput;
  sourcePayload: Record<string, unknown>;
  sourceFileName: string;
  resultFileBaseName: string;
}> {
  const parsed = HoroscopeExportSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(`人生剧本参数校验失败: ${parsed.error.message}`);
  }

  const input = parsed.data;
  const astrolabe = getNatalAstrolabe(input);
  const allDecades = getDecadalOptions(astrolabe).slice(0, 9).map((item) => ({
    startAge: item.startAge,
    endAge: item.endAge,
  }));
  const fortuneBaseName = ensureFortuneBaseName(input.fileBaseName);

  const payload = await buildHoroscopeExportPayload({
    ...input,
    fileBaseName: fortuneBaseName,
    selected_decades: allDecades,
    selected_years: [],
    selected_months: [],
    selected_days: [],
  });

  const sourceFileName = await saveJsonPayload(
    payload as Record<string, unknown>,
    fortuneBaseName
  );

  return {
    input,
    sourcePayload: payload as Record<string, unknown>,
    sourceFileName,
    resultFileBaseName: buildLifeScriptBaseName(fortuneBaseName),
  };
}
