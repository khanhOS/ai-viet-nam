// /chat — Giao diện chat (composer bắt đầu hội thoại mới)

import type { Metadata } from "next";
import { KhanhOSApp } from "@/components/app/khanhos-app";

export const metadata: Metadata = {
  title: "Chat — KhanhOS AI",
  description: "Trò chuyện cùng KhanhOS AI.",
};

export default function ChatPage() {
  return <KhanhOSApp />;
}
