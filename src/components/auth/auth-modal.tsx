// KhanhOS AI — Auth Modal (login / register / forgot password)
// Modal glass với hệ animation mượt: vào bằng spring + blur, đổi bước trượt
// theo hướng, thành công → panel dấu tích vẽ + hạt bay → flash sáng màn hình.
// KHÔNG reload trang. Không dùng chữ "demo"/"token".

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore, type AuthModalStep } from "@/store/use-auth-store";
import { useChatStore } from "@/store/use-chat-store";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";
import { ForgotPasswordForm } from "./forgot-password-form";
import { SuccessBurst } from "./success-burst";
import { Sparkles } from "lucide-react";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const STEP_ORDER: Record<AuthModalStep, number> = { login: 0, register: 1, forgot: 2 };

export function AuthModal() {
  const open = useAuthStore((s) => s.authModalOpen);
  const step = useAuthStore((s) => s.authModalStep);
  const pendingMessage = useAuthStore((s) => s.pendingMessage);
  const setStep = useAuthStore((s) => s.setAuthModalStep);
  const closeAuthModal = useAuthStore((s) => s.closeAuthModal);
  const [success, setSuccess] = useState(false);
  const [flash, setFlash] = useState(false);
  // Đọc token reset từ deep-link /reset-password?token=... (hoặc /?reset=... cũ)
  // qua lazy initializer (giá trị client-only; modal đóng lúc SSR nên không hydration mismatch)
  const [resetToken, setResetToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("token") ?? params.get("reset");
  });

  // Hướng trượt khi đổi bước (login <-> register <-> forgot)
  // Pattern usePrevious bằng state trễ 1 commit — không đọc ref trong render
  const [prevStep, setPrevStep] = useState<AuthModalStep>(step);
  const dir = STEP_ORDER[step] >= STEP_ORDER[prevStep] ? 1 : -1;
  useEffect(() => {
    setPrevStep(step);
  }, [step]);

  // Deep-link reset token → mở thẳng form đặt lại mật khẩu
  useEffect(() => {
    if (!resetToken) return;
    useAuthStore.getState().openAuthModal("forgot");
    // Dọn URL cho sạch
    window.history.replaceState({}, "", window.location.pathname);
  }, [resetToken]);

  // Đóng modal → reset state cục bộ
  useEffect(() => {
    if (!open) setSuccess(false);
  }, [open]);

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      closeAuthModal();
      setResetToken(null);
    }
  };

  // Sau khi login/register thành công: panel dấu tích chơi song song với
  // việc nạp dữ liệu → modal tự đóng → flash sáng màn hình → gửi pending message
  const onAuthSuccess = async () => {
    setSuccess(true);
    const { pendingMessage, refreshUser } = useAuthStore.getState();
    const work = (async () => {
      await refreshUser();
      useChatStore.getState().loadConversations();
      useChatStore.getState().loadModels();
    })();
    // Cho animation kịch hết (dấu tích vẽ + hạt bay)
    await new Promise((r) => setTimeout(r, 1250));
    await work;
    closeAuthModal();
    setFlash(true);
    setTimeout(() => setFlash(false), 850);
    if (pendingMessage) {
      useChatStore.getState().sendMessage(pendingMessage);
    }
  };

  const titles: Record<AuthModalStep, { title: string; desc: string }> = {
    login: { title: "Đăng nhập", desc: "Chào mừng bạn trở lại KhanhOS AI." },
    register: { title: "Đăng ký", desc: "Tạo tài khoản KhanhOS AI miễn phí." },
    forgot: { title: "Đặt lại mật khẩu", desc: "Lấy lại quyền truy cập tài khoản." },
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="kh-glass-strong max-w-[400px] rounded-2xl border-foreground/10 p-0 overflow-hidden"
          showCloseButton={false}
        >
          {/* Brand strip */}
          <div className="relative flex items-center justify-center border-b border-foreground/8 px-6 pb-4 pt-5">
            <div
              className="absolute inset-x-0 -top-16 h-24 opacity-40"
              style={{
                background:
                  "radial-gradient(ellipse 60% 100% at 50% 100%, oklch(0.78 0.13 172 / 25%), transparent)",
              }}
            />
            <div className="relative flex items-center gap-2.5">
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 20, delay: 0.08 }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 kh-glow-sm"
              >
                <Sparkles className="h-4 w-4 text-primary" />
              </motion.div>
              <div className="text-left">
                <div className="font-display text-base font-semibold tracking-tight">
                  KhanhOS <span className="text-primary">AI</span>
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  Nền tảng AI thế hệ mới
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Context: đăng nhập để chat */}
          <AnimatePresence>
            {pendingMessage && step !== "forgot" && !success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mx-5 mt-3 rounded-xl border border-primary/25 bg-primary/8 px-3.5 py-2.5">
                  <p className="text-xs font-medium text-primary">Đăng nhập để bắt đầu trò chuyện</p>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    Tin nhắn của bạn: “{pendingMessage}”
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="px-6 pb-6 pt-4">
            <AnimatePresence mode="wait" initial={false}>
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9, filter: "blur(6px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="flex flex-col items-center gap-4 py-7"
                >
                  <SuccessBurst />
                  <div className="space-y-1 text-center">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.34, duration: 0.3, ease: EASE }}
                      className="font-display text-base font-semibold tracking-tight"
                    >
                      {step === "register" ? "Tài khoản đã sẵn sàng!" : "Đăng nhập thành công!"}
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.46, duration: 0.3, ease: EASE }}
                      className="text-xs text-muted-foreground"
                    >
                      Đang vào KhanhOS AI…
                    </motion.div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 24 * dir, scale: 0.985, filter: "blur(4px)" }}
                  animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: -24 * dir, scale: 0.985, filter: "blur(4px)" }}
                  transition={{ duration: 0.26, ease: EASE }}
                >
                  <DialogHeader className="space-y-1 pb-3 text-left">
                    <DialogTitle className="font-display text-lg font-semibold tracking-tight">
                      {titles[step].title}
                    </DialogTitle>
                    <DialogDescription className="text-[13px]">
                      {titles[step].desc}
                    </DialogDescription>
                  </DialogHeader>

                  {step === "login" && (
                    <LoginForm
                      onSuccess={onAuthSuccess}
                      onSwitchRegister={() => setStep("register")}
                      onSwitchForgot={() => setStep("forgot")}
                    />
                  )}
                  {step === "register" && (
                    <RegisterForm
                      onSuccess={onAuthSuccess}
                      onSwitchLogin={() => setStep("login")}
                    />
                  )}
                  {step === "forgot" && (
                    <ForgotPasswordForm
                      presetToken={resetToken}
                      onDone={() => {
                        setResetToken(null);
                        setStep("login");
                      }}
                      onSwitchLogin={() => {
                        setResetToken(null);
                        setStep("login");
                      }}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      {/* Flash sáng màn hình sau khi đăng nhập/đăng ký thành công */}
      <AnimatePresence>
        {flash && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-[70]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 65% 55% at 50% 42%, oklch(0.78 0.13 172 / 22%), transparent 70%)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
