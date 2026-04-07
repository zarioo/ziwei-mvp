import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import {
  getSessionByToken,
  getSessionTokenFromRequest,
} from "@/services/sessionStore";
import { addChart, listChartsByEmail } from "@/services/chartStore";

export const runtime = "nodejs";
export const maxDuration = 10;

const ChartSchema = z.object({
  form: z.object({
    name: z.string().default(""),
    gender: z.enum(["男", "女"]),
    birthday: z.string().min(1, "出生日期不能为空"),
    birthTime: z.string().min(1, "出生时辰不能为空"),
    birthplace: z.string().default(""),
  }),
  input: z.object({
    calendar: z.enum(["solar", "lunar"]).default("solar"),
    date: z.string().min(1, "出生日期不能为空"),
    timeIndex: z.number().int().min(0).max(12),
    gender: z.enum(["男", "女"]),
    fixLeap: z.boolean().optional(),
    isLeapMonth: z.boolean().optional(),
    language: z.string().optional(),
  }),
  result: z.object({
    solarBirthDate: z.string().nullable(),
    lunarBirthDate: z.string().nullable(),
    wuxingju: z.string().nullable(),
    mingzhu: z.string().nullable(),
    shenzhu: z.string().nullable(),
    palaces: z.array(
      z.object({
        displayName: z.string().nullable(),
        dizhi: z.string().nullable(),
        tianGan: z.string().nullable(),
        majorStars: z.array(z.object({ name: z.string().nullable() })),
        minorStars: z.array(z.object({ name: z.string().nullable() })),
      })
    ),
  }),
});

async function getAuthedEmail(request: Request) {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;
  const session = await getSessionByToken(token);
  return session?.email ?? null;
}

export async function GET(request: Request) {
  const email = await getAuthedEmail(request);
  if (!email) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const charts = await listChartsByEmail(email);
  return NextResponse.json({ charts });
}

export async function POST(request: Request) {
  const email = await getAuthedEmail(request);
  if (!email) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = ChartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数校验失败", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const chart = await addChart({
    id: crypto.randomUUID(),
    email,
    createdAt: new Date().toISOString(),
    form: parsed.data.form,
    input: parsed.data.input,
    result: parsed.data.result,
  });

  return NextResponse.json({ chart });
}

