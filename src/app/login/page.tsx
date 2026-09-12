// /login — Trang đăng nhập (dùng chung shell app, mở modal login)

import type { Metadata } from "next";
import { KhanhOSApp } from "@/components/app/khanhos-app";

export const metadata: Metadata = {
  title: "Đăng nhập — KhanhOS AI",
  description: "Đăng nhập vào KhanhOS AI để tiếp tục trò chuyện.",
};

export default function LoginPage() {
  return <KhanhOSApp initial={{ authModal: "login" }} />;
}
