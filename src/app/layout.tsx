import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getLang } from "@/lib/i18n";
import "./globals.css";
/*
  머리말 **안**에 앉는 서비스 메뉴바(@dss/ui)의 생김새. 그 묶음은 CSS 를 스스로 부르지
  않는다 — 그러면 번들러 없이는 조각을 부를 수 없게 되어 그쪽 시험이 깨진다.
  그래서 쓰는 쪽이 한 번 부른다. globals.css 다음에 두어 Tailwind 의 기본
  초기화(preflight)보다 나중에 오게 한다.
*/
import "@dss/ui/styles.css";
/*
  머리말 **오른쪽 끝**에 앉는 알림 종(@dss/ui)의 생김새. 🔴 위 메뉴바의
  styles.css 와 **다른 파일**이다 — 그 묶음은 조각마다 CSS 한 장이고, 한 장으로
  묶으려면 CSS 안에서 @import 를 해야 하는데 그것은 그쪽 시험이 막는다
  (README 7절). 그래서 쓰는 쪽이 조각마다 한 번씩 부른다.

  규칙은 전부 `.dss-bell` 아래에만 있고, 종은 보여 줄 알림이 **있을 때만**
  그려진다(없으면 조각이 스스로 null 이다). 이 줄이 로그인 화면까지 닿아도
  바뀌는 것은 없다 — 메뉴바 CSS 와 같은 자리·같은 이유다. 이 사이트는
  라이트 고정이라 다크 규칙은 걸리지 않는다(colorScheme 을 넘기지 않는다).
*/
import "@dss/ui/notification-bell.css";

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
