// /chat/[id] — Mở một cuộc hội thoại cụ thể (deep-link, có authorization)

import type { Metadata } from "next";
import { KhanhOSApp } from "@/components/app/khanhos-app";

export const metadata: Metadata = {
  title: "Hội thoại — KhanhOS AI",
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <KhanhOSApp initial={{ openConversationId: id }} />;
}
