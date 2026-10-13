import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "数字成都 · 天府三街",
  description:
    "从天府三街开始，漫游街区、发现建筑，一起完善数字成都。真实开放地图轮廓与社区贡献。",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
