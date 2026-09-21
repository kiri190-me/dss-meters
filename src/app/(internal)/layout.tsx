import { Suspense, type ReactNode } from "react";

import { ServiceMenuBar } from "@dss/ui";

import { AppHeader } from "@/components/AppHeader";
import { PortalNotificationBell } from "@/components/PortalNotificationBell";
import { requireSession } from "@/lib/auth/guards";
import { portalAppsUrl } from "@/lib/auth/oidc";
import { readServiceMenu } from "@/lib/auth/service-menu-cookie";
import { env } from "@/lib/env";
import { getDictionary } from "@/lib/i18n";

/**
 * 사내 구간. 여기 아래는 전부 세션이 있어야 볼 수 있다.
 * 세션 검증은 이 한 곳에서 하고, 각 화면에서 또 확인하지 않는다.
 * (데이터를 바꾸는 서버 액션은 별도로 다시 검증한다)
 */
export default async function InternalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireSession();
  const { lang, t } = await getDictionary();

  // 서비스 메뉴바가 그릴 사내 시스템 목록. 포털이 로그인 ID 토큰에 실어 보낸
  // 것을 SSO 콜백이 별도 서명 쿠키에 구워 두었다(auth/service-menu-cookie.ts).
  // 쿠키가 없거나 못 믿을 것이면 빈 배열이고, 그때 목록은 아예 그려지지 않는다
  // (빈 자리도 남기지 않는다 — @dss/ui 의 ServiceMenuBar 가 그렇게 동작한다).
  // 포털의 그 기능이 배포되기 전까지는 늘 이 상태다.
  const services = await readServiceMenu();
  // 「지금 여기」로 눌러 그릴 칸을 고르는 열쇠 — 이 시스템의 client_id 다
  // (= ID 토큰의 aud). 목록이 있을 때만 읽는다: 값이 없으면 env 가 터지는데,
  // 메뉴 하나 때문에 사내 구간 전체가 열리지 않아서는 안 된다.
  const currentServiceId = services.length > 0 ? env.ssoClientId : null;

  return (
    <div className="flex min-h-full flex-col">
      {/*
        🔴 2026-09-18: 머리말 **위**에 독립된 회색 띠로 앉히던 것을 머리말
        **안**으로 들였다(A/S 가 먼저 한 것과 같은 이유 — 회색 층이 한 줄을
        더 차지해 화면 위쪽이 답답하고 창이 그만큼 작아진다).

        한때 여기 적혀 있던 걱정("이 머리말은 flex-wrap 이라 칸이 여럿 붙는
        목록을 끼우면 좁은 화면에서 줄이 늘어져 무너진다")은 메뉴바가
        **드롭다운 단추 하나**가 되면서 통째로 사라졌다(@dss/ui,
        2026-09-18 오후) — 머리말이 내주는 폭이 서비스 수와 무관해졌다.
        폭을 정하는 장치는 머리말 쪽의 `shrink-0` 래퍼 한 겹이다
        (근거는 AppHeader.tsx 주석의 폭 셈).

        `variant="inline"` — 제 바탕도 아래 테두리도 없이 머리말 바탕 위에 그대로
        얹히고, 폰(<768px)에서는 **단추**가 아이콘 하나로 줄어든다. 펼친 목록의
        이름은 폰에서도 보인다(@dss/ui README 3절).

        펼치고 접는 것은 `<details>` 라 **자바스크립트 없이** 된다. 바깥을 눌러
        접기와 Esc 만 묶음 안의 작은 조각(`DropdownDismiss`, 그것만
        `"use client"`)이 **얹는다** — 아무것도 그리지 않아 마크업이 늘지
        않는다. 🔴 그렇다고 이 파일이나 AppHeader 에 `"use client"` 를 붙이지
        않는다. 딸려 오는 조각은 묶음 안에 있고 이 파일과 무관하다.

        🔴 펼친 목록은 단추 아래로 **떠서**(position: absolute, z-index 50)
        그려진다. 그래서 머리말이나 그 조상에 `overflow: hidden` 이 있으면
        목록이 잘려 아무것도 고를 수 없다 — 이 저장소의 그 줄(html.h-full →
        body.min-h-full → 이 div → header)에는 한 곳도 없고, 쌓임 맥락을
        새로 만드는 것(z-index·transform·filter·isolation)도 없다.

        메뉴바 자체에는 `shrink-0` 을 주지 않는다: 그것은 세로 flex 안에서
        띠로 앉을 때의 것이고, 여기서 뜻이 있는 것은 **머리말의 flex 항목**
        (위 래퍼)뿐이다. 조각에 걸어도 아무 일도 하지 않으면서 읽는 사람만
        헷갈리게 한다.

        `no-print` 는 남긴다 — 이 사이트는 목록을 종이로 뽑는다. 머리말이 이미
        `no-print` 라 함께 감춰지고 @dss/ui 의 CSS 도 @media print 로 스스로
        감추지만, 세 겹이어도 해롭지 않고 머리말 쪽이 바뀌어도 남는다.

        노치 인셋은 이 저장소에 한 곳도 없다(viewport-fit=cover 를 쓰지 않는다)
        — inline 모습은 padding-top 을 0 으로 못 박아 두므로 켤 것도 끌 것도 없다.
      */}
      <AppHeader
        user={user}
        lang={lang}
        t={t}
        portalUrl={portalAppsUrl()}
        serviceMenu={
          <ServiceMenuBar
            services={services}
            currentServiceId={currentServiceId}
            label={t.nav.serviceMenu}
            variant="inline"
            className="no-print"
          />
        }
        notificationBell={
          /*
            다른 시스템들의 알림을 모아 그리는 종(@dss/ui). 목록은 포털이
            합쳐 준다 — 부르는 자리는 PortalNotificationBell 안이다.
            🔴 이 사이트 자체의 알림은 여기 없다: 교정 기한 알림은 **메일로만**
            나가고 화면에 쌓이는 종이 없다(docs/NOTIFY.md). 그래서 받은 것이
            곧 전부이고, 포털도 부른 사이트 자신에게는 묻지 않는다.

            🔴 `<Suspense>` 가 이 조각의 전부다. 이 레이아웃은 모든 화면에
            딸려 오므로, 감싸지 않으면 **모든 화면 이동이 포털 왕복만큼
            느려진다**(포털이 느리면 더). 감싸면 머리말과 본문이 먼저 뜨고
            종만 나중에 흘러 들어온다.

            fallback 이 null 인 이유: 알림이 없을 때 종이 아예 안 그려지는
            것과 **같은 모습**이라 자리가 들썩이지 않는다. 뼈대(skeleton)를
            두면 알림이 없는 사람에게는 「있다가 사라지는 종」이 된다.

            🔴 실패는 이 자리에 오지 않는다 — fetchPortalNotifications 가
            어떤 거절(401·403·429·503·시간 초과)도 삼키고 빈 목록을 돌려준다.
            그래서 error boundary 가 필요 없고, 포털이 죽어도 이 머리말은
            예전과 똑같이 뜬다.

            `no-print` 를 따로 넘기지 않는다 — 메뉴바와 달리 @dss/ui 의 종
            CSS 가 `@media print { display: none }` 을 제 안에 갖고 있고,
            머리말 자체도 `no-print` 다.
          */
          <Suspense fallback={null}>
            <PortalNotificationBell subject={user.authSub} />
          </Suspense>
        }
      />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
