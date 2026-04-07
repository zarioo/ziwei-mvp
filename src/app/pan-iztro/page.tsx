"use client";

import { useEffect, useMemo, useState } from "react";
import { astro } from "iztro";
import iztroI18n from "iztro/lib/i18n";
import { Iztrolabe } from "react-iztro";
import PanShell from "@/components/PanShell";
import styles from "../pan/page.module.css";

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
  birthday: string;
  birthTime: number;
  gender: "男" | "女";
  birthdayType: "solar";
  fixLeap?: boolean;
  lang?: string;
};

const DEFAULT_FORM: FormState = {
  name: "",
  gender: "女",
  birthday: "1991-08-26",
  birthTime: "20:00",
  birthplace: "",
};

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

export default function PanIztroPage() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [panelInput, setPanelInput] = useState<PanelInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 覆盖内置文案：把"仆役"统一显示为"交友"，避免前端展示旧称呼
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const i18nInstance = iztroI18n as any;
    if (i18nInstance?.addResourceBundle) {
      i18nInstance.addResourceBundle(
        "zh-CN",
        "translation",
        { friendsPalace: "交友" },
        true,
        true
      );
    }
  }, []);

  const timeIndex = useMemo(() => toTimeIndex(form.birthTime), [form.birthTime]);
  const timeLabel =
    TIME_INDEX_OPTIONS.find((item) => item.value === timeIndex)?.label || "";

  const onSubmit = () => {
    setLoading(true);
    setError(null);
    try {
      if (!form.birthday || !form.birthTime) {
        throw new Error("请填写出生日期与出生时辰");
      }
      // 这里是前端直接调用 iztro 计算，和“接口排盘”不同
      astro.bySolar(form.birthday, timeIndex, form.gender, true, "zh-CN");
      setPanelInput({
        birthday: form.birthday,
        birthTime: timeIndex,
        gender: form.gender,
        birthdayType: "solar",
        fixLeap: true,
        lang: "zh-CN",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "排盘失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PanShell active="iztro">
      <div className={styles.page}>
        <div className={styles.container}>
          <header className={styles.hero}>
            <div>
              <h1 className={styles.serif}>iztro排盘</h1>
              <p>前端本地计算 + react-iztro 原始盘面。</p>
            </div>
          </header>

          <div className={styles.layout}>
            <section className={styles.card}>
              <h2 className={styles.serif}>输入信息</h2>
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
              <button
                className={styles.button}
                onClick={onSubmit}
                disabled={loading}
              >
                {loading ? "排盘中..." : "开始排盘"}
              </button>
              {error && <p className={styles.error}>{error}</p>}
              <p className={styles.helper}>
                说明：本页面使用前端直算，不经过后端接口。
              </p>
            </section>

            <section className={`${styles.card} ${styles.resultCard}`}>
              <div className={styles.resultHeader}>
                <h2 className={styles.serif}>紫微斗数排盘结果</h2>
                {panelInput && (
                  <div className={styles.meta}>
                    <span>姓名：{form.name || "未填写"}</span>
                    <span>出生地：{form.birthplace || "未填写"}</span>
                    <span>
                      阳历：{form.birthday} {form.birthTime}
                    </span>
                  </div>
                )}
              </div>

              {panelInput ? (
                <div className={styles.astrolabeWrap}>
                  <Iztrolabe
                    width="100%"
                    birthday={panelInput.birthday}
                    birthTime={panelInput.birthTime}
                    gender={panelInput.gender}
                    birthdayType={panelInput.birthdayType}
                    fixLeap={panelInput.fixLeap}
                    lang={panelInput.lang}
                    horoscopeDate={new Date()}
                    horoscopeHour={panelInput.birthTime}
                    centerPalaceAlign
                  />
                </div>
              ) : (
                <div className={styles.placeholder}>
                  请先填写出生信息并点击“开始排盘”
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </PanShell>
  );
}

