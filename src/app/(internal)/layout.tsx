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
  // 쿠키가 없거나 못 믿을 것이면 빈 배열이고, 그때 띠는 아예 그려지지 않는다
  // (빈 띠도 남기지 않는다 — @dss/ui 의 ServiceMenuBar 가 그렇게 동작한다).
  // 포털의 그 기능이 배포되기 전까지는 늘 이 상태다.
  const services = await readServiceMenu();
  // 「지금 여기」로 눌러 그릴 칸을 고르는 열쇠 — 이 시스템의 client_id 다
  // (= ID 토큰의 aud). 목록이 있을 때만 읽는다: 값이 없으면 env 가 터지는데,
  // 띠 하나 때문에 사내 구간 전체가 열리지 않아서는 안 된다.
  const currentServiceId = services.length > 0 ? env.ssoClientId : null;

  return (
    <div className="flex min-h-full flex-col">
      {/*
        머리말 **안**이 아니라 **위**에 독립된 띠로 앉힌다. 이 머리말은 항목이
        줄바꿈되는 flex-wrap 한 줄이라, 칸이 여럿 붙는 목록을 끼워 넣으면 좁은
        화면에서 줄이 늘어져 무너진다(@dss/ui README 3절). 그래서 머리말은 한
        줄도 고치지 않았다. 목록이 비면 이 조각이 스스로 아무것도 그리지 않는다.
        shrink-0 은 세로 flex 안에서 눌리지 않게, no-print 는 이 사이트가 목록을
        종이로 뽑기 때문이다(그쪽 CSS 도 @media print 로 스스로 감추지만, 그
        CSS 가 안 실린 상태에서도 종이에 나오지 않게 두 겹으로).
      */}
      <ServiceMenuBar
        services={services}
        currentServiceId={currentServiceId}
        label={t.nav.serviceMenu}
        className="shrink-0 no-print"
      />
      <AppHeader user={user} lang={lang} t={t} portalUrl={portalAppsUrl()} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
