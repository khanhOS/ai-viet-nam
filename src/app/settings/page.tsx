// /settings — Cài đặt người dùng (yêu cầu đăng nhập)

import type { Metadata } from "next";
import { KhanhOSApp } from "@/components/app/khanhos-app";

export const metadata: Metadata = {
  title: "Cài đặt — KhanhOS AI",
  description: "Tuỳ chọn giao diện, model mặc định và trải nghiệm.",
};

export default function SettingsPage() {
  return <KhanhOSApp initial={{ openSettings: true }} />;
}
