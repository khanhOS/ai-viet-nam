// /reset-password — Trang đặt lại mật khẩu (?token=... từ email)

import type { Metadata } from "next";
import { KhanhOSApp } from "@/components/app/khanhos-app";

export const metadata: Metadata = {
  title: "Đặt lại mật khẩu — KhanhOS AI",
  description: "Đặt mật khẩu mới cho tài khoản KhanhOS AI.",
};

export default function ResetPasswordPage() {
  return <KhanhOSApp initial={{ openReset: true }} />;
}
