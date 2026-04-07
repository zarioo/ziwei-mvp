import db from "./db";

export type StoredChart = {
  id: string;
  email: string;
  createdAt: string;
  form: {
    name: string;
    gender: "男" | "女";
    birthday: string;
    birthTime: string;
    birthplace: string;
  };
  input: {
    calendar: "solar" | "lunar";
    date: string;
    timeIndex: number;
    gender: "男" | "女";
    fixLeap?: boolean;
    isLeapMonth?: boolean;
    language?: string;
  };
  result: {
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
};

export async function listChartsByEmail(email: string) {
  const rows = db
    .prepare(
      "SELECT id, email, created_at AS createdAt, form_json AS formJson, input_json AS inputJson, result_json AS resultJson FROM charts WHERE email = ? ORDER BY created_at DESC"
    )
    .all(email) as Array<{
    id: string;
    email: string;
    createdAt: string;
    formJson: string;
    inputJson: string;
    resultJson: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    createdAt: row.createdAt,
    form: JSON.parse(row.formJson),
    input: JSON.parse(row.inputJson),
    result: JSON.parse(row.resultJson),
  })) as StoredChart[];
}

export async function addChart(chart: StoredChart) {
  db.prepare(
    "INSERT INTO charts (id, email, created_at, form_json, input_json, result_json) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    chart.id,
    chart.email,
    chart.createdAt,
    JSON.stringify(chart.form),
    JSON.stringify(chart.input),
    JSON.stringify(chart.result)
  );
  return chart;
}

