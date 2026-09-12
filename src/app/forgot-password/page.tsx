// /forgot-password — Trang yêu cầu đặt lại mật khẩu

import type { Metadata } from "next";
import { KhanhOSApp } from "@/components/app/khanhos-app";

export const metadata: Metadata = {
  title: "Quên mật khẩu — KhanhOS AI",
  description: "Lấy lại quyền truy cập tài khoản KhanhOS AI.",
};

export default function ForgotPasswordPage() {
  return <KhanhOSApp initial={{ authModal: "forgot" }} />;
}
