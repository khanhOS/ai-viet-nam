// KhanhOS AI — Login form
// Animation: field cascade stagger, nút submit morph (label -> tròn loading),
// lỗi rung khẽ + viền nhấp nháy. Không dùng chữ "demo"/"token".

"use client";

import { useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Loader2, LogIn } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const containerV: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } },
};

const itemV: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(3px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.36, ease: EASE },
  },
};

interface LoginFormProps {
  onSuccess: () => void;
  onSwitchRegister: () => void;
  onSwitchForgot: () => void;
}

export function LoginForm({ onSuccess, onSwitchRegister, onSwitchForgot }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errN, setErrN] = useState(0); // key để replay rung lỗi
  const { toast } = useToast();

  const fail = (msg: string) => {
    setError(msg);
    setErrN((n) => n + 1);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // Validation client nhẹ
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      fail("Email không hợp lệ");
      return;
    }
    if (!password) {
      fail("Vui lòng nhập mật khẩu");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        fail(data?.error ?? "Đăng nhập thất bại");
        return;
      }
      toast({ title: `Chào mừng trở lại, ${data.user.name}!` });
      onSuccess();
    } catch {
      fail("Lỗi kết nối. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      onSubmit={submit}
      className="space-y-3.5"
      noValidate
      variants={containerV}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemV} className="space-y-1.5">
        <Label htmlFor="login-email" className="text-[13px]">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="ban@vidu.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`h-10 rounded-xl border-foreground/10 bg-foreground/4 focus-visible:border-primary/40 ${error ? "kh-err-pulse" : ""}`}
        />
      </motion.div>

      <motion.div variants={itemV} className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password" className="text-[13px]">Mật khẩu</Label>
          <button
            type="button"
            onClick={onSwitchForgot}
            className="text-xs text-primary/80 transition-colors hover:text-primary hover:underline"
          >
            Quên mật khẩu?
          </button>
        </div>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 rounded-xl border-foreground/10 bg-foreground/4 focus-visible:border-primary/40"
        />
      </motion.div>

      {error && (
        <motion.p
          key={errN}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="kh-shake rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </motion.p>
      )}

      <motion.div variants={itemV}>
        <motion.button
          type="submit"
          disabled={loading}
          initial={false}
          animate={{
            width: loading ? 40 : "100%",
            borderRadius: loading ? 999 : 12,
          }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          whileTap={{ scale: 0.97 }}
          className="relative flex h-10 items-center justify-center overflow-hidden bg-primary font-medium text-primary-foreground kh-glow-sm hover:brightness-110"
          style={{ width: "100%" }}
        >
          <AnimatePresence initial={false}>
            {loading ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.16, ease: EASE }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
              </motion.span>
            ) : (
              <motion.span
                key="label"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="absolute inset-0 flex items-center justify-center gap-2"
              >
                <LogIn className="h-4 w-4" />
                Đăng nhập
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      <motion.p
        variants={itemV}
        className="text-center text-xs text-muted-foreground"
      >
        Chưa có tài khoản?{" "}
        <button
          type="button"
          onClick={onSwitchRegister}
          className="font-medium text-primary/90 transition-colors hover:text-primary hover:underline"
        >
          Đăng ký
        </button>
      </motion.p>
    </motion.form>
  );
}
