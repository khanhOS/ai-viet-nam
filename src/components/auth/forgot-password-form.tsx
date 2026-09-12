// KhanhOS AI — Forgot password form (3 bước)
// Bước 1: nhập email → gửi link reset
// Bước 2: nhập mã token (auto-fill nếu deep-link /?reset=token)
// Bước 3: mật khẩu mới + xác nhận → xong

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Mail, KeyRound, ShieldCheck, ExternalLink, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ForgotPasswordFormProps {
  presetToken?: string | null;
  onDone: () => void;
  onSwitchLogin: () => void;
}

type Step = 1 | 2 | 3;

export function ForgotPasswordForm({ presetToken, onDone, onSwitchLogin }: ForgotPasswordFormProps) {
  const [step, setStep] = useState<Step>(presetToken ? 2 : 1);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(presetToken ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (presetToken) {
      setStep(2);
      setToken(presetToken);
    }
  }, [presetToken]);

  // ── Bước 1: gửi yêu cầu reset ────────────────
  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Email không hợp lệ");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Không gửi được yêu cầu");
        return;
      }
      setDevResetLink(data?.devResetLink ?? null);
      setStep(2);
    } catch {
      setError("Lỗi kết nối. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  // ── Bước 3: đặt mật khẩu mới ─────────────────
  const doReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!token.trim()) return setError("Vui lòng nhập mã đặt lại");
    if (password.length < 4) return setError("Mật khẩu phải có ít nhất 4 ký tự");
    if (password.length > 128) return setError("Mật khẩu tối đa 128 ký tự");
    if (password !== confirmPassword)
      return setError("Xác nhận mật khẩu không khớp");

    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Đặt lại mật khẩu thất bại");
        return;
      }
      toast({ title: "Đặt lại mật khẩu thành công", description: "Đăng nhập bằng mật khẩu mới." });
      onDone();
    } catch {
      setError("Lỗi kết nối. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const stepInfo = [
    { icon: Mail, title: "Email xác minh" },
    { icon: KeyRound, title: "Mã đặt lại" },
    { icon: ShieldCheck, title: "Mật khẩu mới" },
  ];

  return (
    <div>
      {/* Progress indicator 3 bước */}
      <div className="mb-5 flex items-center justify-center gap-2">
        {stepInfo.map((info, i) => {
          const idx = i + 1;
          const active = idx === step;
          const done = idx < step;
          return (
            <div key={idx} className="flex items-center gap-2">
              <motion.div
                animate={{
                  scale: active ? 1.1 : 1,
                  backgroundColor:
                    active || done
                      ? "oklch(0.7 0.12 172 / 18%)"
                      : "color-mix(in srgb, var(--foreground) 5%, transparent)",
                  borderColor:
                    active || done
                      ? "oklch(0.65 0.12 172 / 40%)"
                      : "color-mix(in srgb, var(--foreground) 10%, transparent)",
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border"
              >
                <info.icon
                  className={`h-3.5 w-3.5 ${active || done ? "text-primary" : "text-muted-foreground"}`}
                />
              </motion.div>
              {i < 2 && (
                <div
                  className={`h-px w-8 transition-colors ${done ? "bg-primary/40" : "bg-foreground/10"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >
          {step === 1 && (
            <form onSubmit={requestReset} className="space-y-3.5" noValidate>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Nhập email tài khoản KhanhOS AI. Chúng tôi sẽ gửi mã đặt lại mật khẩu
                (hiệu lực 60 phút, dùng 1 lần).
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className="text-[13px]">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="ban@vidu.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 rounded-xl border-foreground/10 bg-foreground/4 focus-visible:border-primary/40"
                />
              </div>
              {error && <ErrorNote message={error} />}
              <SubmitButton loading={loading} label="Gửi mã đặt lại" icon={Mail} />
              <BackToLogin onClick={onSwitchLogin} />
            </form>
          )}

          {step === 2 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep(3);
                setError(null);
              }}
              className="space-y-3.5"
              noValidate
            >
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Nhập mã đặt lại đã gửi tới email của bạn.
                {devResetLink && (
                  <span className="mt-2 block rounded-lg border border-primary/25 bg-primary/8 p-2.5 text-xs">
                    <span className="text-muted-foreground">Dev mode (chưa cấu hình email):</span>{" "}
                    <a
                      href={devResetLink}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      mở link đặt lại <ExternalLink className="h-3 w-3" />
                    </a>
                  </span>
                )}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="forgot-token" className="text-[13px]">Mã đặt lại</Label>
                <Input
                  id="forgot-token"
                  placeholder="Dán mã từ email / link"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="h-10 rounded-xl border-foreground/10 bg-foreground/4 font-mono text-xs focus-visible:border-primary/40"
                />
              </div>
              {error && <ErrorNote message={error} />}
              <SubmitButton label="Tiếp tục" icon={KeyRound} />
              <BackToLogin onClick={onSwitchLogin} />
            </form>
          )}

          {step === 3 && (
            <form onSubmit={doReset} className="space-y-3.5" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-[13px]">Mật khẩu mới</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Từ 4 đến 128 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 rounded-xl border-foreground/10 bg-foreground/4 focus-visible:border-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-confirm" className="text-[13px]">Xác nhận mật khẩu</Label>
                <Input
                  id="new-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-10 rounded-xl border-foreground/10 bg-foreground/4 focus-visible:border-primary/40"
                />
              </div>
              {error && <ErrorNote message={error} />}
              <SubmitButton loading={loading} label="Đặt lại mật khẩu" icon={ShieldCheck} />
              <BackToLogin onClick={onSwitchLogin} />
            </form>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs text-destructive"
    >
      {message}
    </motion.p>
  );
}

function SubmitButton({
  loading,
  label,
  icon: Icon,
}: {
  loading?: boolean;
  label: string;
  icon: React.ElementType;
}) {
  return (
    <motion.button
      type="submit"
      whileTap={{ scale: 0.98 }}
      disabled={loading}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60 kh-glow-sm"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </motion.button>
  );
}

function BackToLogin({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-3 w-3" />
      Quay lại đăng nhập
    </button>
  );
}
