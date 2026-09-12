// /account — Trang tài khoản (yêu cầu đăng nhập)

import type { Metadata } from "next";
import { KhanhOSApp } from "@/components/app/khanhos-app";

export const metadata: Metadata = {
  title: "Tài khoản — KhanhOS AI",
  description: "Thông tin tài khoản KhanhOS AI của bạn.",
};

export default function AccountPage() {
  return <KhanhOSApp initial={{ openAccount: true }} />;
}
