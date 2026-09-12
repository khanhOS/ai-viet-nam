// KhanhOS AI — Email service abstraction
// Hiện tại: DevEmailProvider (log ra console + ghi file để test flow reset).
// Tương lai: cài ResendEmailProvider chỉ bằng cách đổi EMAIL_PROVIDER=resend
// và thêm API key — không ảnh hưởng code gọi.

import { appendFile } from "fs/promises";
import path from "path";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  readonly name: string;
  send(params: SendEmailParams): Promise<{ ok: boolean; error?: string }>;
}

// ─────────────────────────────────────────────
// Dev provider: log console + ghi file (sandbox không có SMTP)
// ─────────────────────────────────────────────
const OUTBOX_FILE = path.join(process.cwd(), "email-outbox.log");

class DevEmailProvider implements EmailProvider {
  readonly name = "dev";

  async send(params: SendEmailParams) {
    const entry = {
      at: new Date().toISOString(),
      to: params.to,
      subject: params.subject,
      text: params.text,
    };
    console.log(`[EMAIL:DEV] → ${params.to} | ${params.subject}\n${params.text}`);
    try {
      await appendFile(OUTBOX_FILE, JSON.stringify(entry) + "\n", "utf-8");
    } catch {
      // không phá flow nếu không ghi được file
    }
    return { ok: true };
  }
}

// ─────────────────────────────────────────────
// Resend provider — template sẵn, kích hoạt bằng env
// ─────────────────────────────────────────────
class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  async send(params: SendEmailParams) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM ?? "KhanhOS AI <onboarding@resend.dev>";
    if (!apiKey) return { ok: false, error: "RESEND_API_KEY chưa cấu hình" };

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });
      if (!res.ok) {
        return { ok: false, error: `Resend lỗi HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Lỗi gửi email" };
    }
  }
}

// ─────────────────────────────────────────────
// EmailService — facade duy nhất app dùng
// ─────────────────────────────────────────────
class EmailService {
  private provider: EmailProvider;

  constructor() {
    const name = process.env.EMAIL_PROVIDER ?? "dev";
    this.provider =
      name === "resend"
        ? new ResendEmailProvider()
        : new DevEmailProvider();
  }

  get providerName() {
    return this.provider.name;
  }

  send(params: SendEmailParams) {
    return this.provider.send(params);
  }

  /** Email đặt lại mật khẩu — link chứa token one-time. */
  sendPasswordResetEmail(to: string, resetLink: string) {
    return this.send({
      to,
      subject: "KhanhOS AI — Đặt lại mật khẩu",
      text: `Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu KhanhOS AI.\n\nMở link sau trong vòng 60 phút (chỉ dùng được 1 lần):\n${resetLink}\n\nNếu không phải bạn, hãy bỏ qua email này.`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#0d9488">KhanhOS AI</h2>
          <p>Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu.</p>
          <p><a href="${resetLink}" style="display:inline-block;background:#14b8a6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Đặt lại mật khẩu</a></p>
          <p style="color:#6b7280;font-size:13px">Link có hiệu lực 60 phút, chỉ dùng 1 lần. Nếu không phải bạn, hãy bỏ qua email này.</p>
        </div>`,
    });
  }
}

export const emailService = new EmailService();
