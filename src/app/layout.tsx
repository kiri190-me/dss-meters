import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getLang } from "@/lib/i18n";
import "./globals.css";
/*
  머리말 위 서비스 메뉴바(@dss/ui)의 생김새. 그 묶음은 CSS 를 스스로 부르지
  않는다 — 그러면 번들러 없이는 조각을 부를 수 없게 되어 그쪽 시험이 깨진다.
  그래서 쓰는 쪽이 한 번 부른다. globals.css 다음에 두어 Tailwind 의 기본
  초기화(preflight)보다 나중에 오게 한다.
*/
import "@dss/ui/styles.css";

export const metadata: Metadata = {
  title: "DSS 계측기 관리",
  description: "사내 계측기 목록 및 교정 기한 관리",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // 화면 언어를 <html lang> 에도 반영한다.
  const lang = await getLang();

  return (
    <html lang={lang} className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
