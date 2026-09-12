import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme/theme-provider";

// Typography KhanhOS:
// - Display: Space Grotesk (nhận diện thương hiệu — hiện đại, kỹ thuật)
// - Body: Inter (đọc lâu mỏi mắt)
// - Code: JetBrains Mono
const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
});

const code = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "KhanhOS AI",
  description:
    "KhanhOS AI — nền tảng AI thế hệ mới. Trò chuyện, tạo, khám phá cùng trí tuệ nhân tạo.",
  keywords: ["KhanhOS", "AI", "chat AI", "trợ lý AI"],
  authors: [{ name: "KhanhOS" }],
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "KhanhOS AI",
    description: "Nền tảng AI thế hệ mới",
    siteName: "KhanhOS AI",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        className={`${display.variable} ${body.variable} ${code.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
