// KhanhOS AI — Register form
// Validation: email hợp lệ, password 4–128 ký tự (không yêu cầu chữ/số), confirm khớp.
// Animation: field cascade stagger, nút submit morph (label -> tròn loading),
// lỗi rung khẽ. Không dùng chữ "demo"/"token".

"use client";

import { useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Loader2, UserPlus, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const containerV: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
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

interface RegisterFormProps {
  onSuccess: () => void;
  onSwitchLogin: () => void;
}

export function RegisterForm({ onSuccess, onSwitchLogin }: RegisterFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errN, setErrN] = useState(0); // key để replay rung lỗi
  const { toast } = useToast();

  const fail = (msg: string) => {
    setError(msg);
    setErrN((n) => n + 1);
    return undefined;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // Validation client
    if (name.trim() && name.trim().length > 50) return fail("Tên hiển thị tối đa 50 ký tự");
    if (!name.trim()) return fail("Vui lòng nhập tên hiển thị");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return fail("Email không hợp lệ");
    if (password.length < 4) return fail("Mật khẩu phải có ít nhất 4 ký tự");
    if (password.length > 128) return fail("Mật khẩu tối đa 128 ký tự");
    if (password !== confirmPassword)
      return fail("Xác nhận mật khẩu không khớp");

    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        fail(data?.error ?? "Đăng ký thất bại");
        return;
      }
      toast({ title: `Chào mừng ${data.user.name} đến KhanhOS AI!` });
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
        <Label htmlFor="reg-name" className="text-[13px]">Tên hiển thị</Label>
        <Input
          id="reg-name"
          autoComplete="name"
          placeholder="Tên của bạn"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 rounded-xl border-foreground/10 bg-foreground/4 focus-visible:border-primary/40"
        />
      </motion.div>

      <motion.div variants={itemV} className="space-y-1.5">
        <Label htmlFor="reg-email" className="text-[13px]">Email</Label>
        <Input
          id="reg-email"
          type="email"
          autoComplete="email"
          placeholder="ban@vidu.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 rounded-xl border-foreground/10 bg-foreground/4 focus-visible:border-primary/40"
        />
      </motion.div>

      <motion.div variants={itemV} className="space-y-1.5">
        <Label htmlFor="reg-password" className="text-[13px]">Mật khẩu</Label>
        <div className="relative">
          <Input
            id="reg-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Từ 4 đến 128 ký tự"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 rounded-xl border-foreground/10 bg-foreground/4 focus-visible:border-primary/40 pr-10"
          />
          <motion.button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            whileTap={{ scale: 0.85 }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </motion.button>
        </div>
      </motion.div>

      <motion.div variants={itemV} className="space-y-1.5">
        <Label htmlFor="reg-confirm" className="text-[13px]">Xác nhận mật khẩu</Label>
        <Input
          id="reg-confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
                <UserPlus className="h-4 w-4" />
                Đăng ký
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      <motion.p
        variants={itemV}
        className="text-center text-xs text-muted-foreground"
      >
        Đã có tài khoản?{" "}
        <button
          type="button"
          onClick={onSwitchLogin}
          className="font-medium text-primary/90 transition-colors hover:text-primary hover:underline"
        >
          Đăng nhập
        </button>
      </motion.p>
    </motion.form>
  );
}
