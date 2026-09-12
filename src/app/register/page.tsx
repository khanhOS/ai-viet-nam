// /register — Trang đăng ký tài khoản

import type { Metadata } from "next";
import { KhanhOSApp } from "@/components/app/khanhos-app";

export const metadata: Metadata = {
  title: "Đăng ký — KhanhOS AI",
  description: "Tạo tài khoản KhanhOS AI miễn phí.",
};

export default function RegisterPage() {
  return <KhanhOSApp initial={{ authModal: "register" }} />;
}
