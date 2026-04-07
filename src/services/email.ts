import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const EMAIL_FROM = process.env.EMAIL_FROM ?? "Ziwei <noreply@yourdomain.com>";

export async function sendLoginCodeEmail(email: string, code: string) {
  if (!RESEND_API_KEY) {
    throw new Error("缺少 RESEND_API_KEY，无法发送验证码邮件");
  }
  const resend = new Resend(RESEND_API_KEY);
  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: "紫微斗数登录验证码",
    text: `你的登录验证码是：${code}，10 分钟内有效。`,
  });
}

