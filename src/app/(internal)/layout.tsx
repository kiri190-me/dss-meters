import type { ReactNode } from "react";

import { ServiceMenuBar } from "@dss/ui";

import { AppHeader } from "@/components/AppHeader";
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
        목록을 끼우면 좁은 화면에서 줄이 늘어져 무너진다")은 `min-w-0 flex-1`
        래퍼 하나로 사라진다: 기준 폭이 0 인 항목은 줄 나누기에 영향을 주지
        못해 **어느 폭에서도 줄바꿈 모양을 바꾸지 않는다**(AppHeader.tsx 주석).

        `variant="inline"` — 제 바탕도 아래 테두리도 없이 머리말 바탕 위에 그대로
        얹히고, 폰(<768px)에서는 칸마다 아이콘만 보인다(@dss/ui README 3절).
        `shrink-0` 은 **뺀다**: 세로 flex 안에서 눌리지 않게 하던 것인데, 이제는
        반대로 가로 flex 안에서 줄어들 수 있어야 한다.

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
      />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
