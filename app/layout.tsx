import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  return {
    metadataBase,
    title: "하루여행 — 하루가 가벼워지는 여행 플래너",
    description: "취향과 시간에 맞춰 걷기 좋은 하루 여행 동선을 만들어보세요.",
    openGraph: { title: "하루여행", description: "하루가 가벼워지는 여행 플래너", images: ["/og.png"] },
    twitter: { card: "summary_large_image", title: "하루여행", description: "하루가 가벼워지는 여행 플래너", images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
